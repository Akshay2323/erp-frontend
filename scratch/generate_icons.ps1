[void][System.Reflection.Assembly]::LoadWithPartialName("System.Drawing")

function Create-Icon ($Size, $Path, $IsMaskable) {
    # Create Bitmap
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    # Enable high quality rendering
    $g.SmoothingMode = [System.Drawing.Drawing2d.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
    
    # 1. Background Brush (Linear Gradient from #4f46e5 to #6366f1)
    $color1 = [System.Drawing.Color]::FromArgb(79, 70, 229)
    $color2 = [System.Drawing.Color]::FromArgb(99, 102, 241)
    $rect = New-Object System.Drawing.Rectangle 0, 0, $Size, $Size
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $color1, $color2, 45.0
    
    # Draw Background
    $g.FillRectangle($brush, $rect)
    
    # 2. Draw modern stylized logo - A white circle outline with an bold letter "A"
    # Safe area scaling: if maskable, keep content inside 55% of size, otherwise 70%
    $safeScale = if ($IsMaskable) { 0.55 } else { 0.70 }
    $contentSize = $Size * $safeScale
    $offset = ($Size - $contentSize) / 2
    
    # Draw a thin white ring
    $penWidth = [Math]::Max(1.0, $Size * 0.03)
    $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(180, 255, 255, 255)), $penWidth
    $g.DrawEllipse($pen, $offset, $offset, $contentSize, $contentSize)
    
    # Draw "A" letter in the center
    # Find fitting font size
    $fontSize = [float]($contentSize * 0.60)
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
    
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    
    # Text Rect
    $textRect = New-Object System.Drawing.RectangleF 0, 0, $Size, $Size
    $g.DrawString("A", $font, $textBrush, $textRect, $sf)
    
    # Save image
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    
    # Cleanup
    $sf.Dispose()
    $textBrush.Dispose()
    $font.Dispose()
    $pen.Dispose()
    $brush.Dispose()
    $g.Dispose()
    $bmp.Dispose()
    Write-Host "Generated: $Path"
}

# Generate PWA Icons
$publicDir = "public"
Create-Icon 192 "$publicDir/icon-192x192.png" $false
Create-Icon 192 "$publicDir/icon-192x192-maskable.png" $true
Create-Icon 512 "$publicDir/icon-512x512.png" $false
Create-Icon 512 "$publicDir/icon-512x512-maskable.png" $true
