<#
.SYNOPSIS
    Creates directories and empty files from a plain list of paths.

.DESCRIPTION
    Reads a text file containing relative or absolute paths.
    Automatically uses the correct path separator for the OS.
    Creates directories if the path ends with "/", otherwise creates empty files.
#>

param (
    [Parameter(Mandatory = $true)]
    [string]$InputFile,   # Path to structure.txt

    [string]$BasePath = (Get-Location).Path
)

try {
    if (-not (Test-Path -Path $InputFile -PathType Leaf)) {
        throw "Input file '$InputFile' not found."
    }

    # Detect OS path separator
    $sep = [System.IO.Path]::DirectorySeparatorChar

    $paths = Get-Content -Path $InputFile | Where-Object { $_.Trim() -ne "" }

    foreach ($path in $paths) {
        # Normalize separators for current OS
        $normalizedPath = $path -replace '[\\/]', $sep

        $fullPath = Join-Path -Path $BasePath -ChildPath $normalizedPath

        if ($path.EndsWith("/")) {
            # Create directory
            if (-not (Test-Path -Path $fullPath)) {
                New-Item -Path $fullPath -ItemType Directory -Force | Out-Null
                Write-Host "Created directory: $fullPath"
            }
        }
        elseif ($path -match '\.') {
            # Create file (ensure parent directory exists)
            $dir = Split-Path -Path $fullPath -Parent
            if (-not (Test-Path -Path $dir)) {
                New-Item -Path $dir -ItemType Directory -Force | Out-Null
            }
            if (-not (Test-Path -Path $fullPath)) {
                New-Item -Path $fullPath -ItemType File -Force | Out-Null
                Write-Host "Created file: $fullPath"
            }
        }
    }

    Write-Host "Structure creation completed successfully." -ForegroundColor Green
}
catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
