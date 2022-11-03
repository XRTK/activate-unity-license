# Unity Action
param(
    [String]$editorPath,
    [String]$projectPath,
    [String]$buildTarget,
    [String]$additionalArgs,
    [String]$name = "Unity"
)

try {
    $additionalArgs = $additionalArgs.Trim()
    $buildTargetArgs = ""

    if ( -not [string]::IsNullOrEmpty($buildTarget) ) {
        $buildTargetArgs = "-buildTarget `"$buildTarget`" "
    }

    $logDirectory = "$projectPath/Builds/Logs"

    if ( -not (Test-Path -Path $logDirectory)) {
        $logDirectory = New-Item -ItemType Directory -Force -Path $logDirectory | Select-Object
    }

    Write-Host "Log Directory: $logDirectory"

    $date = Get-Date -Format "yyyyMMddTHHmmss"
    $logName = "$logDirectory/$name-$date"
    $logPath = "$logName.log"

    if ( $additionalArgs -like "*runEditorTests" ) {
        $testPath = "$logName.xml"
        $additionalArgs += " -editorTestsResultFile `"$testPath`""
    }

    $buildArgs = "$buildTargetArgs-projectPath `"$projectPath`" -logfile `"$logPath`" $additionalArgs"
    Write-Host "::group::$editorPath $buildArgs"

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
            Write-Host "Unity process has ended unexpectedly..."
            break
        }
    }

    Write-Host "Unity Process $processId Complete!"

    # Wait for the last of the log information to be written
    $fileLocked = $true
    $timeout = New-TimeSpan -Seconds 10
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

    do {
        try
        {
            $file = Convert-Path $logPath
            $fileStream = [System.IO.File]::Open($file,'Open','Write')
            $fileStream.Close()
            $fileStream.Dispose()
            $fileLocked = $false
        }
        catch
        {
            $fileLocked = $true
        }

        if ( $stopwatch.elapsed -lt $timeout )
        {
        if ( (-not $global:PSVersionTable.Platform) -or ($global:PSVersionTable.Platform -eq "Win32NT") ) {
            Write-Host "Attempting to cleanup orphaned processes..."
            $procsWithParent = Get-CimInstance -ClassName "win32_process" | Select-Object ProcessId,ParentProcessId
            $orphaned = $procsWithParent | Where-Object -Property ParentProcessId -NotIn $procsWithParent.ProcessId
            $procs = Get-Process -IncludeUserName | Where-Object -Property Id -In $orphaned.ProcessId | Where-Object { $_.UserName -match $env:username }
            $procs | ForEach-Object { Stop-Process -Id $_.Id -ErrorAction SilentlyContinue }
        }
        }

        Start-Sleep -Milliseconds 1
    } while ( $fileLocked )

    Write-Host "End of log stream"
    Write-Host "Cleaning up jobs..."

    # Clean up job
    Receive-Job $ljob
    Stop-Job $ljob
    Remove-Job $ljob

    Write-Host "::endgroup::"

    exit $process.ExitCode
}
catch {
    exit 1
}