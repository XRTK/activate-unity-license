param(
    [String]$path,
    [String]$licenseInfo
)

Out-File -FilePath $path -InputObject $licenseInfo

if ( -not (Test-Path -Path $logDirectory)) {
    Write-Error "Failed to create ulf file at $logDirectory"
    exit 1
}