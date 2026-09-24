# Smoke test de l'API LoanTrack — crée des données de démonstration.
# Usage : powershell -File scripts/smoke-test.ps1
$ErrorActionPreference = 'Continue'
$base = 'http://localhost:3001'

function Api {
  param([string]$Method, [string]$Path, [hashtable]$Body = $null, [string]$Token = $null)
  $headers = @{ 'Content-Type' = 'application/json' }
  if ($Token) { $headers.Authorization = "Bearer $Token" }
  $json = $null
  if ($Body) { $json = $Body | ConvertTo-Json -Depth 5 }
  try {
    $r = Invoke-RestMethod -Uri ($base + $Path) -Method $Method -Headers $headers -Body $json -TimeoutSec 15
    return @{ ok = $true; data = $r }
  } catch {
    $msg = $_.Exception.Message
    if ($_.ErrorDetails) { $msg = $_.ErrorDetails.Message }
    return @{ ok = $false; data = $msg }
  }
}

Write-Host "== 1. Login admin/admin123 =="
$login = Api 'POST' '/auth/login' @{ username = 'admin'; password = 'admin123' }
if (-not $login.ok) { Write-Host "ECHEC: $($login.data)"; exit 1 }
$token = $login.data.data.token
Write-Host "OK token=$($token.Substring(0, 20))..."

Write-Host "`n== 2. Dashboard (vide au départ) =="
$d = Api 'GET' '/dashboard' -Token $token
Write-Host "OK kpis=$((($d.data).data.kpis | ConvertTo-Json -Compress))"

Write-Host "`n== 3. Création de 2 clients (réutilise s'ils existent déjà) =="
function GetOrCreateClient {
  param([string]$FirstName, [string]$LastName, [string]$Phone, [string]$Address, [string]$Token)
  $existing = Api 'GET' '/clients' -Token $Token
  $found = $existing.data.data | Where-Object { $_.phone -eq $Phone }
  if ($found) { return $found }
  $created = Api 'POST' '/clients' @{ firstName = $FirstName; lastName = $LastName; phone = $Phone; address = $Address } -Token $Token
  if (-not $created.ok) { Write-Host "ECHEC: $($created.data)"; exit 1 }
  return $created.data.data
}
$c1 = GetOrCreateClient 'Awa' 'Diallo' '0700000001' 'Abidjan, Cocody' $token
$c2 = GetOrCreateClient 'Yao' 'Kouassi' '0700000002' 'Abidjan, Yopougon' $token
Write-Host "OK client1=$($c1.id) client2=$($c2.id)"

Write-Host "`n== 4. Téléphone dupliqué doit être refusé (409) =="
$dup = Api 'POST' '/clients' @{ firstName = 'Z'; lastName = 'Z'; phone = '0700000001' } -Token $token
Write-Host "($(-not $dup.ok)) message=$($dup.data)"

Write-Host "`n== 5. Création de prêts (niveau 1 et 2) — réutilise les prêts existants =="
function GetOrCreateLoan {
  param([int]$ClientId, [int]$Level, [string]$Token)
  $existing = Api 'GET' '/loans' -Token $Token
  $found = $existing.data.data | Where-Object { $_.client.id -eq $ClientId -and $_.level -eq $Level }
  if ($found) { return $found }
  $created = Api 'POST' '/loans' @{ clientId = $ClientId; level = $Level } -Token $Token
  if (-not $created.ok) { Write-Host "ECHEC: $($created.data)"; exit 1 }
  return $created.data.data
}
$l1 = GetOrCreateLoan $c1.id 1 $token
$l2 = GetOrCreateLoan $c2.id 2 $token
Write-Host "OK loan1=$($l1.id) loan2=$($l2.id)"

Write-Host "`n== 6. Second prêt pour client1 doit être refusé (409) =="
$dup2 = Api 'POST' '/loans' @{ clientId = $c1.id; level = 1 } -Token $token
Write-Host "($(-not $dup2.ok)) message=$($dup2.data)"

Write-Host "`n== 7. Remboursement partiel (ou déjà effectué) =="
$det1 = Api 'GET' "/loans/$($l1.id)" -Token $token
if ($det1.data.data.totalRembourse -eq 0) {
  $r1 = Api 'POST' "/loans/$($l1.id)/repayments" @{ amount = 10000; paymentDate = (Get-Date -Format 'yyyy-MM-dd') } -Token $token
  Write-Host "OK soldeRestant=$($r1.data.data.soldeRestant)"
} else {
  Write-Host "OK déjà remboursé (totalRembourse=$($det1.data.data.totalRembourse))"
}

Write-Host "`n== 8. Remboursement > solde refusé (400) =="
$rBig = Api 'POST' "/loans/$($l1.id)/repayments" @{ amount = 999999 } -Token $token
Write-Host "($(-not $rBig.ok)) message=$($rBig.data)"

Write-Host "`n== 9. Historique remboursements =="
$h = Api 'GET' "/loans/$($l1.id)/repayments" -Token $token
Write-Host "OK count=$($h.data.data.Count)"

Write-Host "`n== 10. Transactions (pagination) =="
$t = Api 'GET' '/transactions?page=1&limit=20' -Token $token
Write-Host "OK total=$($t.data.pagination.total) rows=$($t.data.data.Count)"

Write-Host "`n== 11. Changement de mot de passe (admin123 -> temp1234) puis retour =="
$pw = Api 'PATCH' '/auth/password' @{ currentPassword = 'admin123'; newPassword = 'temp1234' } -Token $token
Write-Host "OK change=$($pw.ok)"
$back = Api 'PATCH' '/auth/password' @{ currentPassword = 'temp1234'; newPassword = 'admin123' } -Token $token
Write-Host "OK retour=$($back.ok)"

Write-Host "`n== 12. Route protégée sans token doit renvoyer 401 =="
try {
  Invoke-RestMethod -Uri ($base + '/clients') -Method GET -TimeoutSec 10 | Out-Null
  Write-Host "ECHEC: pas de 401"
} catch {
  Write-Host "OK status=$($_.Exception.Response.StatusCode.value__)"
}

Write-Host "`n== 13. Détail du prêt =="
$det = Api 'GET' "/loans/$($l1.id)" -Token $token
Write-Host "OK totalRembourse=$($det.data.data.totalRembourse) solde=$($det.data.data.soldeRestant)"

Write-Host "`n=== FIN DU SMOKE TEST ==="
