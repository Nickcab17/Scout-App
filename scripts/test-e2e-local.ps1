$ErrorActionPreference = "Stop"

$localCli = Join-Path $PSScriptRoot "..\node_modules\.bin\supabase.cmd"
$globalCli = Get-Command supabase -ErrorAction SilentlyContinue
if (Test-Path -LiteralPath $localCli) {
  $supabaseCommand = $localCli
} elseif ($globalCli) {
  $supabaseCommand = $globalCli.Source
} else {
  throw "Supabase CLI no está instalado. Añádelo al proyecto con npm install --save-dev supabase."
}

& $supabaseCommand start | Out-Null
if ($LASTEXITCODE -ne 0) { throw "No se pudo iniciar Supabase local. Comprueba que Docker Desktop esté iniciado." }
$statusLines = & $supabaseCommand status -o env
if ($LASTEXITCODE -ne 0) { throw "No se pudo leer el estado del Supabase local." }
$values = @{}
foreach ($line in $statusLines) {
  if ($line -match '^(API_URL|SUPABASE_URL|ANON_KEY|PUBLISHABLE_KEY)=(.*)$') {
    $values[$Matches[1]] = $Matches[2].Trim('"', "'")
  }
}
$apiUrl = $values["API_URL"]
if (-not $apiUrl) { $apiUrl = $values["SUPABASE_URL"] }
$anonKey = $values["ANON_KEY"]
if (-not $anonKey) { $anonKey = $values["PUBLISHABLE_KEY"] }
if (-not $apiUrl -or -not $anonKey) { throw "supabase status no entregó URL y clave pública local." }
$localHost = ([uri]$apiUrl).Host
if ($localHost -notin @("localhost", "127.0.0.1", "::1")) { throw "La URL reportada por Supabase no es loopback; Playwright no se iniciará." }

$env:PLAYWRIGHT_LOCAL_SUPABASE = "1"
$env:NEXT_PUBLIC_SUPABASE_URL = $apiUrl
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $anonKey
npm.cmd run test:e2e
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
