$ErrorActionPreference = 'Stop'

$TaskName = 'RealitySimulator-ScrapeAll'
$Repository = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c "cd /d C:\Users\USER\reality-stimulator && npm run scrape:all >> scrape-scheduler.log 2>&1"'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ((New-TimeSpan -Days 3650))
$settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Write-Host "Scheduled task '$TaskName' installed to run npm run scrape:all every 15 minutes."
