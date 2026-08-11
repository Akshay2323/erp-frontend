$outDir = Join-Path $PSScriptRoot "..\public\audio"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

Add-Type -AssemblyName System.Speech

function New-PunchVoiceSynth {
  param($FemaleVoice)
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
  if ($FemaleVoice) {
    $synth.SelectVoice($FemaleVoice.VoiceInfo.Name)
  }
  $synth.Rate = 2
  $synth.Volume = 100
  return $synth
}

$female = (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() |
  Where-Object { $_.VoiceInfo.Gender -eq "Female" } |
  Select-Object -First 1

if ($female) {
  Write-Host "Using voice: $($female.VoiceInfo.Name)"
} else {
  Write-Host "Using default voice"
}

$message = "Thank you!"

foreach ($name in @("punch-in-thank-you.wav", "punch-out-thank-you.wav", "thank-you.wav")) {
  $path = Join-Path $outDir $name
  $synth = New-PunchVoiceSynth -FemaleVoice $female
  $synth.SetOutputToWaveFile($path)
  $synth.Speak($message)
  $synth.Dispose()
  Write-Host "Created $name"
}

Get-ChildItem $outDir | Format-Table Name, Length
