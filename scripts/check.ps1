$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    npm test
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed.' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    Push-Location (Join-Path $repoRoot 'backend')
    try {
        python -m pytest tests
        if ($LASTEXITCODE -ne 0) { throw 'Backend tests failed.' }
    }
    finally {
        Pop-Location
    }
}
finally {
    Pop-Location
}
