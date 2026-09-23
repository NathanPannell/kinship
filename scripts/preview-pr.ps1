param([Parameter(Mandatory)][ValidateRange(1,2147483647)][int]$PullRequest, [switch]$Apply)
. (Join-Path $PSScriptRoot 'preview-common.ps1')

$paths = Get-Paths $PullRequest
$lock = Enter-Lock $paths
try {
  $baseSha = Assert-CleanBase
  $pr = Get-Pr $PullRequest
  Assert-Remote $pr $baseSha
  Invoke-Git -Arguments @('fetch','origin',$pr.headRefName) | Out-Null
  if ((Invoke-Git -Arguments @('rev-parse','FETCH_HEAD')).Trim() -ne $pr.headRefOid) { throw 'Fetched head differs from GitHub PR.' }
  $headVercelConfig = (Invoke-Git -Arguments @('show',"$($pr.headRefOid):vercel.json") | Out-String | ConvertFrom-Json)
  if ($headVercelConfig.git.deploymentEnabled -ne $false) { throw 'PR head does not disable Vercel Git auto-deployments.' }
  $linked = Get-Content -LiteralPath (Join-Path $script:RepoRoot '.vercel/project.json') -Raw | ConvertFrom-Json
  if ($linked.projectId -ne $script:PreviewConfig.VercelProjectId -or $linked.orgId -ne $script:PreviewConfig.VercelOrgId) { throw 'Local Vercel link differs from checked-in project identity.' }
  if (Test-Path -LiteralPath $paths.Active) { throw 'An active lifecycle record already exists. Use teardown or recover that record.' }
  if (Test-Path -LiteralPath $paths.Journal) { throw 'A prior journal exists. Inspect and recover it before creating another preview.' }
  $release = "networking-crm-pr-$PullRequest-$($pr.headRefOid.Substring(0,12))-$([Guid]::NewGuid().ToString('N').Substring(0,8))"
  Write-Output "PR: $PullRequest"
  Write-Output "Head: $($pr.headRefOid)"
  Write-Output "Base: $baseSha"
  Write-Output "Neon parent: $($script:PreviewConfig.NeonParentBranchId)"
  Write-Output "Vercel project: $($script:PreviewConfig.VercelProjectId)"
  Write-Output "Release: $release"
  Write-Output "Journal: $($paths.Journal)"
  if (-not $Apply) { Write-Output 'Plan only. No provider resources were created.'; return }

  Assert-Command npm
  Assert-Secret 'NEON_API_KEY'
  Assert-Secret 'VERCEL_TOKEN'
  Assert-PreviewEnvironment
  $parent = Invoke-Neon GET "/projects/$($script:PreviewConfig.NeonProjectId)/branches/$($script:PreviewConfig.NeonParentBranchId)"
  if ($parent.branch.id -ne $script:PreviewConfig.NeonParentBranchId -or $parent.branch.id -eq $script:PreviewConfig.NeonProductionBranchId) { throw 'Neon development parent identity mismatch.' }
  $matches = @(Get-NeonBranches | Where-Object { $_.name -eq $release })
  if ($matches.Count) { throw 'Release identity already exists in Neon.' }
  $otherPrBranches = @(Get-NeonBranches | Where-Object { $_.name -match "^networking-crm-pr-$PullRequest-[0-9a-f]{12}-[0-9a-f]{8}$" })
  if ($otherPrBranches.Count) { throw 'Another preview branch already exists for this PR.' }
  $headDeployments = @(Get-VercelDeployments | Where-Object { $_.meta.previewRelease -eq $release })
  if ($headDeployments.Count) { throw 'Release identity already exists in Vercel.' }
  $otherPrDeployments = @(Get-VercelDeployments | Where-Object { $_.meta.previewPR -eq "$PullRequest" })
  if ($otherPrDeployments.Count) { throw 'Another preview deployment already exists for this PR.' }
  $existingHeadDeployments = @(Get-VercelDeployments | Where-Object { $_.meta.githubCommitSha -eq $pr.headRefOid -or $_.gitSource.sha -eq $pr.headRefOid })
  if ($existingHeadDeployments.Count) { throw 'The PR head already has a Vercel deployment. Investigate automatic deployment triggers.' }

  $candidate = Join-Path $paths.Directory 'candidate'
  $headWorktree = Join-Path $paths.Directory 'head'
  $saved = @{}
  $credentialNames = @('NEON_API_KEY','VERCEL_TOKEN','GH_TOKEN','GITHUB_TOKEN','DATABASE_URL','DATABASE_URL_UNPOOLED','DEVELOPMENT_DATABASE_URL','APP_PASSWORD','SESSION_SECRET','AGENT_API_TOKEN')
  try {
    Invoke-Git -Arguments @('worktree','add','--detach',$candidate,$baseSha) | Out-Null
    Invoke-Git -Arguments @('worktree','add','--detach',$headWorktree,$pr.headRefOid) | Out-Null
    Push-Location $candidate
    try {
      Invoke-Git -Arguments @('merge','--no-commit','--no-ff',$pr.headRefOid) | Out-Null
      foreach ($name in $credentialNames) { $saved[$name] = [Environment]::GetEnvironmentVariable($name); [Environment]::SetEnvironmentVariable($name, $null) }
      & npm ci --no-audit --no-fund *> $null; if ($LASTEXITCODE -ne 0) { throw 'Candidate dependency install failed.' }
      & npm test *> $null; if ($LASTEXITCODE -ne 0) { throw 'Candidate tests failed.' }
      & npm run lint *> $null; if ($LASTEXITCODE -ne 0) { throw 'Candidate lint failed.' }
      & npm run build *> $null; if ($LASTEXITCODE -ne 0) { throw 'Candidate build failed.' }
    } finally {
      foreach ($name in $credentialNames) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
      Pop-Location
    }
    Push-Location $headWorktree
    try {
      foreach ($name in $credentialNames) { $saved[$name] = [Environment]::GetEnvironmentVariable($name); [Environment]::SetEnvironmentVariable($name, $null) }
      & npm ci --no-audit --no-fund *> $null; if ($LASTEXITCODE -ne 0) { throw 'PR head dependency install failed.' }
      & npm test *> $null; if ($LASTEXITCODE -ne 0) { throw 'PR head tests failed.' }
      & npm run lint *> $null; if ($LASTEXITCODE -ne 0) { throw 'PR head lint failed.' }
      & npm run build *> $null; if ($LASTEXITCODE -ne 0) { throw 'PR head build failed.' }
    } finally {
      foreach ($name in $credentialNames) { [Environment]::SetEnvironmentVariable($name, $saved[$name]) }
      Pop-Location
    }
    Assert-Remote $pr $baseSha
    [IO.Directory]::CreateDirectory((Join-Path $headWorktree '.vercel')) | Out-Null
    Copy-Item -LiteralPath (Join-Path $script:RepoRoot '.vercel/project.json') -Destination (Join-Path $headWorktree '.vercel/project.json')

    $journal = @{
      version=1; repository=$script:PreviewConfig.Repository; pullRequest=$PullRequest; baseSha=$baseSha; headSha=$pr.headRefOid
      release=$release; owner=(Get-Owner); path=$paths.Journal; status='creating'; createdAt=[DateTime]::UtcNow.ToString('o')
      resources=@{ neonBranchId=$null; neonBranchName=$release; neonDatabaseName="preview_$($PullRequest)_$($release.Split('-')[-1])"; vercelDeploymentId=$null; vercelUrl=$null }
      events=@(); observations=@(); limitations=@('GitHub OAuth disabled; no outbound integrations')
    }
    Save-Journal $paths $journal
    Save-Json $paths.Active @{ repository=$journal.repository; pullRequest=$PullRequest; headSha=$journal.headSha; release=$release; owner=$journal.owner; journal=$paths.Journal }

    $neonPath = "/projects/$($script:PreviewConfig.NeonProjectId)"
    Add-Event $paths $journal 'create-neon-branch' 'intent'
    $expiry = [DateTime]::UtcNow.AddDays(7).ToString('yyyy-MM-ddTHH:mm:ssZ')
    $created = Invoke-Neon POST "$neonPath/branches" @{ branch=@{ name=$release; parent_id=$script:PreviewConfig.NeonParentBranchId; init_source='schema-only'; expires_at=$expiry }; endpoints=@(@{type='read_write'}); annotation_value=@{ repository=$script:PreviewConfig.Repository; pr="$PullRequest"; sha=$pr.headRefOid; release=$release } }
    if ($created.branch.name -ne $release -or $created.branch.init_source -notin @('schema-only','parent-schema') -or -not $created.branch.id) { throw 'Neon returned an unexpected branch identity.' }
    $journal.resources.neonBranchId = $created.branch.id
    Add-Event $paths $journal 'create-neon-branch' 'complete'

    $roles = Invoke-Neon GET "$neonPath/branches/$($created.branch.id)/roles"
    $role = @($roles.roles | Where-Object { -not $_.protected } | Select-Object -First 1)
    if ($role.Count -ne 1) { throw 'Could not identify one application database role.' }
    Add-Event $paths $journal 'create-neon-database' 'intent'
    $databasePath = "$neonPath/branches/$($created.branch.id)/databases"
    $database = $null
    for ($attempt = 1; $attempt -le 6; $attempt++) {
      try {
        $database = Invoke-Neon POST $databasePath @{ database=@{ name=$journal.resources.neonDatabaseName; owner_name=$role[0].name } }
        break
      } catch {
        $existing = @( (Invoke-Neon GET $databasePath).databases | Where-Object { $_.name -eq $journal.resources.neonDatabaseName } )
        if ($existing.Count -eq 1) { $database = @{ database=$existing[0] }; break }
        if ($attempt -eq 6) { throw }
        Start-Sleep -Seconds 5
      }
    }
    if ($database.database.name -ne $journal.resources.neonDatabaseName -or $database.database.branch_id -ne $created.branch.id) { throw 'Neon returned an unexpected database identity.' }
    Add-Event $paths $journal 'create-neon-database' 'complete'

    $query = "branch_id=$($created.branch.id)&database_name=$($journal.resources.neonDatabaseName)&role_name=$([Uri]::EscapeDataString($role[0].name))"
    $direct = (Invoke-Neon GET "$neonPath/connection_uri?$query").uri
    $pooled = (Invoke-Neon GET "$neonPath/connection_uri?${query}&pooled=true").uri
    if (-not $direct -or -not $pooled) { throw 'Neon connection URI unavailable.' }
    $priorDirect = [Environment]::GetEnvironmentVariable('DATABASE_URL_UNPOOLED')
    $priorPooled = [Environment]::GetEnvironmentVariable('DATABASE_URL')
    $runtimeSecretNames = @('NEON_API_KEY','VERCEL_TOKEN','GH_TOKEN','GITHUB_TOKEN','APP_PASSWORD','SESSION_SECRET','AGENT_API_TOKEN')
    $runtimeSecretValues = @{}
    foreach ($name in $runtimeSecretNames) { $runtimeSecretValues[$name] = [Environment]::GetEnvironmentVariable($name); [Environment]::SetEnvironmentVariable($name, $null) }
    $env:DATABASE_URL_UNPOOLED = $direct
    $env:DATABASE_URL = $pooled
    try {
      $empty = & node --input-type=module -e 'import pg from "pg"; const c=new pg.Client({connectionString:process.env.DATABASE_URL_UNPOOLED}); await c.connect(); const r=await c.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema=''public''"); await c.end(); if(r.rows[0].n!==0) process.exit(1)' 2>$null
      if ($LASTEXITCODE -ne 0) { throw 'Fresh preview database is not empty.' }
      Add-Event $paths $journal 'migrate-neon-database' 'intent'
      Push-Location $headWorktree
      try { & npm run migrate *> $null; if ($LASTEXITCODE -ne 0) { throw 'Preview migrations failed.' } }
      finally { Pop-Location }
      Add-Event $paths $journal 'migrate-neon-database' 'complete'
    } finally {
      [Environment]::SetEnvironmentVariable('DATABASE_URL_UNPOOLED', $priorDirect)
      [Environment]::SetEnvironmentVariable('DATABASE_URL', $priorPooled)
      foreach ($name in $runtimeSecretNames) { [Environment]::SetEnvironmentVariable($name, $runtimeSecretValues[$name]) }
    }

    Assert-Remote $pr $baseSha
    $sessionSecret = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
    $appPassword = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
    $agentToken = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
    $protected = @{ password=($appPassword | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString); agentToken=($agentToken | ConvertTo-SecureString -AsPlainText -Force | ConvertFrom-SecureString) }
    Save-Json (Join-Path $paths.Directory 'preview-credentials.dpapi.json') $protected
    Add-Event $paths $journal 'create-vercel-deployment' 'intent'
    $deployOutput = & vercel deploy --cwd $headWorktree --yes --target preview --scope $script:PreviewConfig.VercelOrgId --token $env:VERCEL_TOKEN --env "DATABASE_URL=$pooled" --env "APP_PASSWORD=$appPassword" --env "SESSION_SECRET=$sessionSecret" --env "AGENT_API_TOKEN=$agentToken" --env "APP_REVISION=$($pr.headRefOid)" --build-env "APP_PASSWORD=$appPassword" --build-env "APP_REVISION=$($pr.headRefOid)" --meta "previewRelease=$release" --meta "previewPR=$PullRequest" --meta "previewSHA=$($pr.headRefOid)" 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Vercel explicit deployment failed. Recover by release metadata before retrying.' }
    $url = @($deployOutput | Where-Object { $_ -match '^https://[A-Za-z0-9.-]+$' } | Select-Object -Last 1)[0]
    if (-not $url) { throw 'Vercel deployment URL unavailable. Recover by release metadata.' }
    $deployment = Invoke-Vercel GET "/v13/deployments/$([Uri]::EscapeDataString($url.Replace('https://','')))"
    if ($deployment.projectId -ne $script:PreviewConfig.VercelProjectId -or $deployment.target -ne 'preview' -or $deployment.meta.previewRelease -ne $release -or $deployment.meta.previewSHA -ne $pr.headRefOid -or -not $deployment.id) { throw 'Vercel deployment identity mismatch.' }
    $journal.resources.vercelDeploymentId = $deployment.id
    $journal.resources.vercelUrl = $url
    Add-Event $paths $journal 'create-vercel-deployment' 'complete'
    $ready = Invoke-RestMethod -Uri "$url/api/ready" -ErrorAction Stop
    if (-not $ready.ready -or $ready.revision -ne $pr.headRefOid) { throw 'Preview readiness or revision check failed.' }
    $journal.status = 'deployed-awaiting-browser-verification'
    Add-Event $paths $journal 'ready-check' 'complete'
    Write-Output "Preview URL: $url"
    Write-Output "Head: $($pr.headRefOid)"
    Write-Output "Journal: $($paths.Journal)"
    Write-Output "Browser verification remains required. Teardown: pwsh -File scripts/teardown-preview-pr.ps1 -PullRequest $PullRequest -Apply"
  } finally {
    foreach ($worktree in @($candidate,$headWorktree)) {
      if (Test-Path -LiteralPath $worktree) { Invoke-Git -Arguments @('worktree','remove','--force',$worktree) | Out-Null }
    }
  }
} catch {
  Write-Error "Preview stopped: $($_.Exception.Message) If a journal exists, inspect it and use pwsh -File scripts/teardown-preview-pr.ps1 -PullRequest $PullRequest -Apply."
} finally { $lock.Dispose() }
