param([Parameter(Mandatory)][ValidateRange(1,2147483647)][int]$PullRequest, [switch]$Apply)
. (Join-Path $PSScriptRoot 'preview-common.ps1')

$paths = Get-Paths $PullRequest
$lock = Enter-Lock $paths
try {
  $active = Read-Json $paths.Active
  $journal = Read-Json $paths.Journal
  if ($active.repository -ne $script:PreviewConfig.Repository -or $journal.repository -ne $active.repository -or
      $active.pullRequest -ne $PullRequest -or $journal.pullRequest -ne $PullRequest -or
      $active.headSha -ne $journal.headSha -or $active.release -ne $journal.release -or
      $active.owner -ne (Get-Owner) -or $journal.owner -ne $active.owner -or
      $active.journal -ne $paths.Journal -or $journal.path -ne $paths.Journal) { throw 'Active record and journal binding mismatch.' }
  if ($journal.headSha -notmatch '^[0-9a-f]{40}$' -or $journal.release -notmatch "^networking-crm-pr-$PullRequest-[0-9a-f]{12}-[0-9a-f]{8}$") { throw 'Invalid journal identity.' }
  if ($journal.status -eq 'cleaned') { throw 'Journal already marked cleaned while active record still exists.' }
  if ($journal.resources.neonBranchId -eq $script:PreviewConfig.NeonParentBranchId -or $journal.resources.neonBranchId -eq $script:PreviewConfig.NeonProductionBranchId) { throw 'Persistent Neon branch cannot be deleted.' }
  Write-Output "PR: $PullRequest"
  Write-Output "Release: $($journal.release)"
  Write-Output "Head: $($journal.headSha)"
  Write-Output "Journal: $($paths.Journal)"
  if (-not $Apply) { Write-Output 'Plan only. No provider resources were deleted.'; return }
  Assert-Secret 'NEON_API_KEY'
  Assert-Secret 'VERCEL_TOKEN'

  $branches = @(Get-NeonBranches)
  $branchMatches = @($branches | Where-Object { $_.name -eq $journal.release })
  if ($branchMatches.Count -gt 1) { throw 'Multiple Neon branches match release identity.' }
  if ($journal.resources.neonBranchId) {
    $branchById = @($branches | Where-Object { $_.id -eq $journal.resources.neonBranchId })
    if ($branchById.Count -gt 1 -or ($branchById.Count -eq 1 -and ($branchById[0].name -ne $journal.release -or $branchById[0].init_source -notin @('schema-only','parent-schema')))) { throw 'Recorded Neon branch identity mismatch.' }
    if ($branchMatches.Count -eq 1 -and $branchMatches[0].id -ne $journal.resources.neonBranchId) { throw 'Release name points to another Neon branch.' }
  } elseif ($branchMatches.Count -eq 1) {
    if ($branchMatches[0].init_source -notin @('schema-only','parent-schema')) { throw 'Recovered Neon branch is not schema-only.' }
    $journal.resources.neonBranchId = $branchMatches[0].id
    Add-Event $paths $journal 'recover-neon-branch' 'complete'
  }

  $deployments = @(Get-VercelDeployments)
  $deployMatches = @($deployments | Where-Object { $_.meta.previewRelease -eq $journal.release -and $_.meta.previewPR -eq "$PullRequest" -and $_.meta.previewSHA -eq $journal.headSha })
  if ($deployMatches.Count -gt 1) { throw 'Multiple Vercel deployments match release identity.' }
  if ($journal.resources.vercelDeploymentId) {
    $deployById = @($deployments | Where-Object { $_.uid -eq $journal.resources.vercelDeploymentId -or $_.id -eq $journal.resources.vercelDeploymentId })
    if ($deployById.Count -gt 1 -or ($deployById.Count -eq 1 -and ($deployById[0].target -ne 'preview' -or $deployById[0].meta.previewRelease -ne $journal.release))) { throw 'Recorded Vercel deployment identity mismatch.' }
    if ($deployMatches.Count -eq 1 -and $deployMatches[0].uid -ne $journal.resources.vercelDeploymentId -and $deployMatches[0].id -ne $journal.resources.vercelDeploymentId) { throw 'Release metadata points to another Vercel deployment.' }
  } elseif ($deployMatches.Count -eq 1) {
    if ($deployMatches[0].target -ne 'preview') { throw 'Recovered Vercel deployment is not a preview.' }
    $journal.resources.vercelDeploymentId = if ($deployMatches[0].uid) { $deployMatches[0].uid } else { $deployMatches[0].id }
    Add-Event $paths $journal 'recover-vercel-deployment' 'complete'
  }

  $errors = @()
  if ($journal.resources.vercelDeploymentId -and $deployMatches.Count -eq 1) {
    try {
      Add-Event $paths $journal 'delete-vercel-deployment' 'intent'
      Invoke-Vercel DELETE "/v13/deployments/$($journal.resources.vercelDeploymentId)" | Out-Null
      Add-Event $paths $journal 'delete-vercel-deployment' 'requested'
    } catch { $errors += 'Vercel deletion failed'; Add-Event $paths $journal 'delete-vercel-deployment' 'failed' }
  }
  if ($journal.resources.neonBranchId -and $branchMatches.Count -eq 1) {
    try {
      Add-Event $paths $journal 'delete-neon-branch' 'intent'
      Invoke-Neon DELETE "/projects/$($script:PreviewConfig.NeonProjectId)/branches/$($journal.resources.neonBranchId)" | Out-Null
      Add-Event $paths $journal 'delete-neon-branch' 'requested'
    } catch { $errors += 'Neon deletion failed'; Add-Event $paths $journal 'delete-neon-branch' 'failed' }
  }

  Start-Sleep -Seconds 20
  $consecutive = 0
  for ($attempt=1; $attempt -le 12 -and $consecutive -lt 3; $attempt++) {
    try {
      $remainingBranches = @(Get-NeonBranches | Where-Object { $_.id -eq $journal.resources.neonBranchId -or $_.name -match "^networking-crm-pr-$PullRequest-[0-9a-f]{12}-[0-9a-f]{8}$" })
      $remainingDeployments = @(Get-VercelDeployments | Where-Object {
        ($journal.resources.vercelDeploymentId -and ($_.uid -eq $journal.resources.vercelDeploymentId -or $_.id -eq $journal.resources.vercelDeploymentId)) -or
        $_.meta.previewPR -eq "$PullRequest"
      })
      $absent = ($remainingBranches.Count -eq 0 -and $remainingDeployments.Count -eq 0)
      $journal.observations += @{ at=[DateTime]::UtcNow.ToString('o'); neonAbsent=($remainingBranches.Count -eq 0); vercelAbsent=($remainingDeployments.Count -eq 0) }
      Save-Journal $paths $journal
      if ($absent) { $consecutive++ } else { $consecutive=0 }
    } catch { $errors += 'Provider inventory query failed'; $consecutive=0; break }
    if ($consecutive -lt 3) { Start-Sleep -Seconds 10 }
  }
  if ($errors.Count -gt 0 -or $consecutive -lt 3) { throw "Cleanup incomplete: $($errors -join ', '). Rerun this exact teardown command after diagnosis." }
  $journal.status = 'cleaned'
  Add-Event $paths $journal 'stable-absence' 'complete'
  Move-Item -LiteralPath $paths.Active -Destination (Join-Path $paths.Directory "active.cleaned.$([DateTime]::UtcNow.ToString('yyyyMMddHHmmss')).json")
  Remove-Item -LiteralPath (Join-Path $paths.Directory 'preview-credentials.dpapi.json') -ErrorAction SilentlyContinue
  Write-Output "Cleanup complete after three consecutive full-inventory absence observations. Journal: $($paths.Journal)"
} catch {
  Write-Error "Teardown stopped: $($_.Exception.Message)"
} finally { $lock.Dispose() }
