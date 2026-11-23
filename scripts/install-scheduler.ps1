$ErrorActionPreference = 'Stop'

$TaskName = 'RealitySimulator-ScrapeAll'
$Repository = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Argument = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"Set-Location '$Repository'; npm run scrape:all`""

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $Argument
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::MaxValue)
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "Scheduled task '$TaskName' installed to run npm run scrape:all every 15 minutes."
