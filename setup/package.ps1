# =============================================================================
# setup/package.ps1
# Creates a distributable zip of Outlook skills for import into Claude Desktop
# or Claude Cowork.
#
# Zip structure:
#   outlook-skills/
#     SKILLS.md               — overview and usage guide
#     outlook-auth/           — skill folders at root level
#     outlook-base/
#     outlook-email-list/
#     ... (all skill folders)
#
# Usage:
#   .\setup\package.ps1
#
# Override default auth install path (used for path rewriting in skill files):
#   .\setup\package.ps1 -InstallDir "D:\tools\outlook-mcp"
# =============================================================================

param(
    [string]$InstallDir = "$env:USERPROFILE\.skills\outlook-mcp"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir
$PkgName   = "outlook-skills"
$Output    = Join-Path $RootDir "$PkgName.zip"
$Tmp       = Join-Path $env:TEMP "outlook-skills-pkg-$([System.Guid]::NewGuid().ToString('N'))"
$PkgDir    = Join-Path $Tmp $PkgName

New-Item -ItemType Directory -Force -Path $PkgDir | Out-Null

# Forward-slash versions of install paths for use inside .md file content
$ProxyPath = ($InstallDir + "\scripts\graph_call.py") -replace '\\', '/'
$AuthPath  = ($InstallDir + "\outlook-skills\auth.sh") -replace '\\', '/'

Write-Host "Packaging Outlook skills..."
Write-Host "  Output:    $Output"
Write-Host "  Auth path: $InstallDir"
Write-Host ""

# ── SKILLS.md overview ────────────────────────────────────────────────────────
Copy-Item -Force "$ScriptDir\SKILLS.md" "$PkgDir\SKILLS.md"

# ── Skill folders (flat — no .claude/skills/ nesting) ────────────────────────
Get-ChildItem "$RootDir\.claude\skills" -Directory |
    Where-Object { $_.Name -like "outlook-*" } |
    ForEach-Object {
        $dest = Join-Path $PkgDir $_.Name
        Copy-Item -Recurse -Force $_.FullName $dest
        # Rewrite proxy and auth paths to default installed locations
        Get-ChildItem $dest -Recurse -Filter "*.md" | ForEach-Object {
            (Get-Content $_.FullName).
                Replace('python3 scripts/graph_call.py', "python3 $ProxyPath").
                Replace('bash outlook-skills/auth.sh', "bash $AuthPath") |
            Set-Content $_.FullName
        }
    }

# ── Create zip ────────────────────────────────────────────────────────────────
Compress-Archive -Path "$PkgDir" -DestinationPath $Output -Force
Remove-Item -Recurse -Force $Tmp

Write-Host "Created: $(Split-Path -Leaf $Output)"
Write-Host ""
Write-Host "Import into Claude Desktop or Claude Cowork via:"
Write-Host "  Settings -> Skills -> Import from zip"
Write-Host ""
Write-Host "Before importing, install the auth system if not already done:"
Write-Host "  .\setup\install.ps1"
Write-Host "  bash $($InstallDir -replace '\\','/')/outlook-skills/auth.sh"
