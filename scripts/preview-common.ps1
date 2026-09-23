$ErrorActionPreference = 'Stop'
$script:PreviewConfig = Import-PowerShellDataFile (Join-Path $PSScriptRoot 'preview-config.psd1')
$script:RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$script:Workspace = Split-Path $script:RepoRoot -Parent
$script:LifecycleRoot = Join-Path $script:Workspace 'preview-lifecycle'

function Assert-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) { throw "Required command unavailable: $Name" }
}
function Assert-Secret([string]$Name) {
  if (-not [Environment]::GetEnvironmentVariable($Name)) { throw "Set $Name in the trusted operator process." }
}
function Get-Paths([int]$PullRequest) {
  $directory = Join-Path $script:LifecycleRoot "pr-$PullRequest"
  return @{ Directory=$directory; Lock=(Join-Path $directory 'lifecycle.lock'); Active=(Join-Path $directory 'active.json'); Journal=(Join-Path $directory 'journal.json') }
}
function Enter-Lock($Paths) {
  [IO.Directory]::CreateDirectory($Paths.Directory) | Out-Null
  try { return [IO.File]::Open($Paths.Lock, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
  catch { throw "Another lifecycle operation holds the lock for this PR." }
}
function Save-Json([string]$Path, $Value) {
  $temporary = "$Path.$([Guid]::NewGuid().ToString('N')).tmp"
  try {
    [IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 20), [Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporary -Destination $Path -Force
  } finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force } }
}
function Read-Json([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "Lifecycle record missing: $Path" }
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json -AsHashtable
}
function Save-Journal($Paths, $Journal) {
  $Journal.updatedAt = [DateTime]::UtcNow.ToString('o')
  Save-Json $Paths.Journal $Journal
}
function Add-Event($Paths, $Journal, [string]$Action, [string]$State) {
  $Journal.events += @{ at=[DateTime]::UtcNow.ToString('o'); action=$Action; state=$State }
  Save-Journal $Paths $Journal
}
function Get-Owner { return "$([Environment]::MachineName):$([Environment]::GetFolderPath('UserProfile'))" }
function Invoke-Git([string[]]$Arguments) {
  $result = & git @Arguments 2>$null
  if ($LASTEXITCODE -ne 0) { throw "Git command failed: $($Arguments[0])" }
  return $result
}
function Get-Pr([int]$PullRequest) {
  Assert-Command gh
  $json = & gh pr view $PullRequest --repo $script:PreviewConfig.Repository --json number,state,isDraft,baseRefName,headRefName,headRefOid,headRepositoryOwner,headRepository,url 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Could not resolve PR from GitHub.' }
  $pr = $json | ConvertFrom-Json
  if ($pr.number -ne $PullRequest -or $pr.state -ne 'OPEN' -or -not $pr.isDraft) { throw 'Expected this exact open draft PR.' }
  if ($pr.baseRefName -ne $script:PreviewConfig.BaseBranch) { throw 'PR base branch differs from configured base.' }
  if ($pr.headRepositoryOwner.login -ne ($script:PreviewConfig.Repository.Split('/')[0]) -or $pr.headRepository.name -ne ($script:PreviewConfig.Repository.Split('/')[1])) { throw 'Fork or cross-repository PR refused.' }
  if ($pr.headRefName -notmatch '^[A-Za-z0-9._/-]+$' -or $pr.headRefName.StartsWith('/') -or $pr.headRefName.Contains('..')) { throw 'Ambiguous PR branch name refused.' }
  if ($pr.headRefOid -notmatch '^[0-9a-f]{40}$') { throw 'PR head is not a full SHA.' }
  return $pr
}
function Assert-Remote([object]$Pr, [string]$BaseSha) {
  $baseRemote = Invoke-Git -Arguments @('ls-remote','origin',"refs/heads/$($script:PreviewConfig.BaseBranch)")
  $headRemote = Invoke-Git -Arguments @('ls-remote','origin',"refs/heads/$($Pr.headRefName)")
  if (@($baseRemote).Count -ne 1 -or (($baseRemote -split '\s+')[0]) -ne $BaseSha) { throw 'Remote base changed.' }
  if (@($headRemote).Count -ne 1 -or (($headRemote -split '\s+')[0]) -ne $Pr.headRefOid) { throw 'Remote PR head changed.' }
  $again = Get-Pr $Pr.number
  if ($again.headRefOid -ne $Pr.headRefOid -or $again.baseRefName -ne $Pr.baseRefName) { throw 'PR changed during operation.' }
}
function Invoke-Neon([string]$Method, [string]$Path, $Body=$null) {
  Assert-Secret 'NEON_API_KEY'
  $params = @{ Method=$Method; Uri="https://console.neon.tech/api/v2$Path"; Headers=@{ Authorization="Bearer $env:NEON_API_KEY" }; ErrorAction='Stop' }
  if ($null -ne $Body) { $params.Body=$Body | ConvertTo-Json -Depth 16; $params.ContentType='application/json' }
  try { return Invoke-RestMethod @params } catch { throw "Neon $Method request failed at a resource endpoint. Inspect provider state before retrying." }
}
function Invoke-Vercel([string]$Method, [string]$Path, $Body=$null) {
  Assert-Secret 'VERCEL_TOKEN'
  $join = if ($Path.Contains('?')) { '&' } else { '?' }
  $params = @{ Method=$Method; Uri="https://api.vercel.com$Path${join}teamId=$($script:PreviewConfig.VercelOrgId)"; Headers=@{ Authorization="Bearer $env:VERCEL_TOKEN" }; ErrorAction='Stop' }
  if ($null -ne $Body) { $params.Body=$Body | ConvertTo-Json -Depth 16; $params.ContentType='application/json' }
  try { return Invoke-RestMethod @params } catch { throw "Vercel $Method request failed at a resource endpoint. Inspect provider state before retrying." }
}
function Get-NeonBranches {
  $all = @(); $cursor = $null
  do {
    $path = "/projects/$($script:PreviewConfig.NeonProjectId)/branches?limit=1000"
    if ($cursor) { $path += "&cursor=$([Uri]::EscapeDataString($cursor))" }
    $page = Invoke-Neon GET $path
    $all += @($page.branches)
    $cursor = $page.pagination.next
  } while ($cursor)
  return $all
}
function Get-VercelDeployments {
  $all = @(); $until = $null
  do {
    $path = "/v6/deployments?projectId=$($script:PreviewConfig.VercelProjectId)&limit=100"
    if ($until) { $path += "&until=$until" }
    $page = Invoke-Vercel GET $path
    $all += @($page.deployments)
    $until = if ($page.pagination.next) { $page.pagination.next } else { $null }
  } while ($until)
  return $all
}
function Assert-PreviewEnvironment {
  $project = Invoke-Vercel GET "/v9/projects/$($script:PreviewConfig.VercelProjectId)"
  $expectedOwner, $expectedRepo = $script:PreviewConfig.Repository.Split('/')
  if ($project.id -ne $script:PreviewConfig.VercelProjectId -or $project.link.org -ne $expectedOwner -or $project.link.repo -ne $expectedRepo) { throw 'Vercel project identity mismatch.' }
  if ($project.link.productionBranch -ne $script:PreviewConfig.BaseBranch) { throw 'Vercel production branch mismatch.' }
  $vars = Invoke-Vercel GET "/v9/projects/$($script:PreviewConfig.VercelProjectId)/env?limit=100"
  if (@($vars.envs | Where-Object { $_.target -contains 'preview' }).Count -gt 0 -or $vars.pagination.next) { throw 'Vercel Preview environment is not proven empty.' }
  $shared = Invoke-Vercel GET "/v1/env?projectId=$($script:PreviewConfig.VercelProjectId)"
  if (@($shared.data | Where-Object { $_.target -contains 'preview' }).Count -gt 0 -or $shared.pagination.next) { throw 'Vercel shared Preview variables are not proven empty.' }
}
function Assert-CleanBase {
  $top = (Invoke-Git -Arguments @('rev-parse','--show-toplevel')).Trim()
  if ($top -ne $script:RepoRoot.Replace('\','/')) { throw 'Run from the canonical repository.' }
  if ((Invoke-Git -Arguments @('status','--porcelain') | Out-String).Trim()) { throw 'Trusted base checkout must be clean.' }
  if ((Invoke-Git -Arguments @('branch','--show-current')).Trim() -ne $script:PreviewConfig.BaseBranch) { throw 'Run from the configured base branch.' }
  $base = (Invoke-Git -Arguments @('rev-parse','HEAD')).Trim()
  $remote = Invoke-Git -Arguments @('ls-remote','origin',"refs/heads/$($script:PreviewConfig.BaseBranch)")
  if ((($remote -split '\s+')[0]) -ne $base) { throw 'Base checkout is not the current remote revision.' }
  return $base
}
