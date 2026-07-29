import fs from 'fs';

async function test() {
  const apiKey = process.env.NEXT_PUBLIC_GROQ_API_KEY || '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';
  const url = 'https://pulsotranscribe-deuw6drnha-uc.a.run.app';
  const buffer = fs.readFileSync('test.mp3');
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'audio/mp3'
      },
      body: buffer
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
