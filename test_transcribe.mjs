import fs from 'fs';

async function test() {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || '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';
  const url = 'https://api.groq.com/openai/v1/audio/transcriptions';
  
  const formData = new FormData();
  const buffer = fs.readFileSync('test.mp3');
  const blob = new Blob([buffer], { type: 'audio/mp3' });
  formData.append('file', blob, 'audio.mp3');
  // fallback to whisper-large-v3 if turbo doesn't work
  formData.append('model', 'whisper-large-v3-turbo'); 
  formData.append('language', 'pt');
  formData.append('response_format', 'json');
  formData.append('temperature', '0.2');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });
    
    if (!res.ok) {
      console.log('Error status:', res.status);
      console.log('Error text:', await res.text());
    } else {
      const json = await res.json();
      console.log('Success:', json);
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

test();
