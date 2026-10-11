# v1.4.2 商店版本地测试证书：自签，Subject 与微软商店 Publisher 逐字一致
# 已存在则跳过；导入公钥到 LocalMachine\TrustedPeople（Add-AppxPackage 需要）
$subj = 'CN=490FE7CA-7868-47E8-A72A-471E4DC9D956'
$exist = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq $subj }
if ($exist) {
    Write-Output ('CERT-EXISTS ' + $exist[0].Thumbprint)
    $cert = $exist[0]
} else {
    $cert = New-SelfSignedCertificate -Type Custom -Subject $subj -KeyUsage DigitalSignature -FriendlyName 'cm-desktop-store-test' -CertStoreLocation 'Cert:\CurrentUser\My' -KeyExportPolicy Exportable -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
    Write-Output ('CERT-CREATED ' + $cert.Thumbprint)
}
$cerPath = Join-Path $PSScriptRoot 'out\cm-store-test.cer'
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
# 当前用户 TrustedPeople（无需管理员；Add-AppxPackage 当前用户安装足够）
Import-Certificate -FilePath $cerPath -CertStoreLocation Cert:\CurrentUser\TrustedPeople | Out-Null
Write-Output 'TRUSTED-PEOPLE-OK'
