# Offline speech recognition (Windows' built-in en-US recognizer) for import_takes.py.
# Reads a list of 16 kHz mono WAV paths (one per line) and writes JSON: for each file, the
# recognized text and every recognized word with its start and length in seconds.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File asr.ps1 -List files.txt -Out asr.json
#
# One continuous recognition per file (RecognizeAsync, Multiple): only then is each phrase's
# position measured from the start of the file. Word positions are relative to their phrase.
# (Repeated synchronous Recognize() calls restart every phrase at 0 s.)
param([Parameter(Mandatory = $true)][string]$List, [Parameter(Mandatory = $true)][string]$Out)
$ErrorActionPreference = 'Stop'  # any failure exits non-zero instead of yielding an empty transcript

Add-Type -AssemblyName System.Speech
$culture = New-Object System.Globalization.CultureInfo('en-US')
$results = New-Object System.Collections.Generic.List[object]
foreach ($file in Get-Content -LiteralPath $List -Encoding UTF8 | Where-Object { $_ -ne '' }) {
  $eng = New-Object System.Speech.Recognition.SpeechRecognitionEngine($culture)
  $eng.LoadGrammar((New-Object System.Speech.Recognition.DictationGrammar))
  $eng.SetInputToWaveFile($file)
  $eng.EndSilenceTimeout = [TimeSpan]::FromSeconds(0.6)
  $eng.BabbleTimeout = [TimeSpan]::FromSeconds(0)
  Register-ObjectEvent -InputObject $eng -EventName SpeechRecognized -SourceIdentifier asr.rec | Out-Null
  Register-ObjectEvent -InputObject $eng -EventName RecognizeCompleted -SourceIdentifier asr.done | Out-Null
  $texts = New-Object System.Collections.Generic.List[string]
  $words = New-Object System.Collections.Generic.List[object]
  try {
    $eng.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple)
    while ($true) {
      $e = Wait-Event -Timeout 120
      if ($null -eq $e) { throw "speech recognition timed out on $file" }
      Remove-Event -EventIdentifier $e.EventIdentifier
      if ($e.SourceIdentifier -eq 'asr.done') { break }
      $r = $e.SourceEventArgs.Result
      $t0 = $r.Audio.AudioPosition.TotalSeconds
      $texts.Add($r.Text)
      foreach ($w in $r.Words) {
        $a = $r.GetAudioForWordRange($w, $w)
        $words.Add([pscustomobject]@{ w = $w.Text; s = [math]::Round($t0 + $a.AudioPosition.TotalSeconds, 3); d = [math]::Round($a.Duration.TotalSeconds, 3) })
      }
    }
  }
  finally {
    Unregister-Event -SourceIdentifier asr.rec
    Unregister-Event -SourceIdentifier asr.done
    $eng.Dispose()
  }
  $results.Add([pscustomobject]@{ file = [string]$file; text = ($texts -join ' '); words = $words.ToArray() })
}
ConvertTo-Json -InputObject $results.ToArray() -Depth 5 | Out-File -LiteralPath $Out -Encoding utf8
