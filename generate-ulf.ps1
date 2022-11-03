param(
    [String]$path,
    [String]$licenseInfo
)

Out-File -FilePath $path -InputObject $licenseInfo
