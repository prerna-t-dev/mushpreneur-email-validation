# ZeroBounce Email Validator

This is a serverless function that validates email addresses using the ZeroBounce API.

## Setup Instructions

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```bash
ZEROBOUNCE_API_KEY=your_api_key_here
```

3. Test locally:
```bash
npm run dev
```

## Deployment to Netlify

1. Create a Netlify account at https://www.netlify.com/
2. Install Netlify CLI:
```bash
npm install -g netlify-cli
```

3. Login to Netlify:
```bash
netlify login
```

4. Initialize your site:
```bash
netlify init
```

5. Deploy:
```bash
netlify deploy --prod
```

6. Set environment variables in Netlify:
   - Go to Site settings > Build & deploy > Environment
   - Add `ZEROBOUNCE_API_KEY` with your ZeroBounce API key

## Usage

Send a POST request to your function URL:
```javascript
fetch('https://your-site.netlify.app/.netlify/functions/validate-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'test@example.com'
  })
});
```

## Response Format

```json
{
  "status": "valid|invalid|catch-all|unknown|spamtrap|abuse|do_not_mail",
  "sub_status": "string",
  "email": "string",
  "score": "number",
  "domain": "string",
  "disposable": "boolean",
  "toxic": "boolean",
  "firstname": "string",
  "lastname": "string",
  "gender": "string",
  "location": "string",
  "region": "string",
  "country": "string",
  "city": "string",
  "zipcode": "string",
  "processed_at": "string"
}
``` 