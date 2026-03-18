Get-Content "project-tree.txt" |
    ForEach-Object { $_ -replace '^[^A-Za-z0-9._/\\-]+', '' } |
    Where-Object { $_.Trim() -ne "" } |
    Set-Content "structure.txt"
