# Unity Action
param(
    [String]$editorPath,
    [String]$projectPath,
    [String]$buildTarget,
    [String]$additionalArgs,
    [String]$logName = "Unity"
)

try {
    $buildArgs = ""

    if ( -not [string]::IsNullOrEmpty($buildTarget) ) {
        $buildArgs += "-buildTarget `"$buildTarget`" "
    }

    if (-not [String]::IsNullOrEmpty($projectPath)) {
        if (($additionalArgs -match "-createManualActivationFile") -or
            ($additionalArgs -match "-manualLicenseFile") -or
            ($additionalArgs -match "-returnlicense") -or
            ($additionalArgs -match "-serial")) {
            Write-Host "License activation, no project path will be set"
        } else {
            $buildArgs += "-projectPath `"$projectPath`" "
            Write-Host "Project Path added to args $projectPath"
        }

        $logDirectory = "$projectPath/Builds/Logs"

        if ( -not (Test-Path -Path $logDirectory)) {
            $logDirectory = New-Item -ItemType Directory -Force -Path $logDirectory | Select-Object
        }

        Write-Host "Log Directory: $logDirectory"

        $date = Get-Date -Format "yyyyMMddTHHmmss"
        $fullLogName = "$logDirectory/$logName-$date"
        $logPath = "$fullLogName.log"
        $buildArgs += "-logfile `"$logPath`" ";
    }

    $additionalArgs = $additionalArgs.Trim()

    if ( $additionalArgs -like "*runEditorTests" ) {
        $testPath = "$fullLogName.xml"
        $additionalArgs += " -editorTestsResultFile `"$testPath`""
    }

    $buildArgs = $buildArgs.Trim()

    $buildArgs += " $additionalArgs"

    $process = Start-Process -FilePath "$editorPath" -ArgumentList "$buildArgs" -PassThru

    $ljob = Start-Job -ScriptBlock {
        param($log)

        while ( -not (Test-Path $log -Type Leaf) ) {
            Start-Sleep -Milliseconds 1
        }

        Get-Content "$log" -Wait
    } -ArgumentList $logPath

    $processId = $process.Id

    while ( -not $process.HasExited )
    {
        # While waiting, Get-Content checks the file once each second
        Start-Sleep -Milliseconds 1
        Receive-Job $ljob

        if ( $null -eq (Get-Process -Id $processId -ErrorAction SilentlyContinue) )
        {
            break
        }
    }

    # Wait for the last of the log information to be written
    $fileLocked = $true
    $timeout = New-TimeSpan -Seconds 10
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    do {
        try
        {
            if (Test-Path -Path $logPath) {
                $file = Convert-Path $logPath
                $fileStream = [System.IO.File]::Open($file,'Open','Write')
                $fileStream.Close()
                $fileStream.Dispose()
                $fileLocked = $false
            } else {
                $fileLocked = $false
            }
        }
        catch
        {
            $fileLocked = $true
        }

        if ( $stopwatch.elapsed -lt $timeout )
        {
            if ( (-not $global:PSVersionTable.Platform) -or ($global:PSVersionTable.Platform -eq "Win32NT") ) {
                $procsWithParent = Get-CimInstance -ClassName "win32_process" | Select-Object ProcessId,ParentProcessId
                $orphaned = $procsWithParent | Where-Object -Property ParentProcessId -NotIn $procsWithParent.ProcessId
                $procs = Get-Process -IncludeUserName | Where-Object -Property Id -In $orphaned.ProcessId | Where-Object { $_.UserName -match $env:username }
                $procs | ForEach-Object { Stop-Process -Id $_.Id -ErrorAction SilentlyContinue }
            }
        }

        Start-Sleep -Milliseconds 1
    } while ( $fileLocked )

    Start-Sleep -Milliseconds 1

    # Clean up job
    Receive-Job $ljob
    Stop-Job $ljob
    Remove-Job $ljob

    exit $process.ExitCode
}
catch {
    exit 1
}