param(
    [String]$path,
    [String]$licenseInfo
)

Out-File -FilePath $path -InputObject $licenseInfo

if ( -not (Test-Path -Path $path)) {
    Write-Error "Failed to create ulf file at $path"
    exit 1
}