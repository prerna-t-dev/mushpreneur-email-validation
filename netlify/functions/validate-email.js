const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    "Access-Control-Allow-Origin": "*", // In production, replace with your domain
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };

  // Handle preflight requests FIRST
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: ""
    };
  }

  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method Not Allowed" })
    };
  }

  try {
    const { email, turnstileToken } = JSON.parse(event.body);
    
    // Validate email format
    const emailRegex = /^[a-zA-Z0-9.]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "Invalid email format" })
      };
    }

    // 1. Verify Cloudflare Turnstile token
    const turnstileSecretKey = process.env.CF_TURNSTILE_SECRET_KEY;
    if (!turnstileToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ turnstileError: "Turnstile token is required" })
      };
    }
    
    if (!turnstileSecretKey) {
      console.error("Turnstile secret key is not configured");
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ turnstileError: "Turnstile verification not configured" })
      };
    }
    
    // Call Cloudflare API to verify the token
    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        secret: turnstileSecretKey,
        response: turnstileToken,
      }),
    });
    
    const turnstileResult = await turnstileResponse.json();
    
    // If Turnstile verification failed, return error
    if (!turnstileResult.success) {
      console.error("Turnstile verification failed:", turnstileResult);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          turnstileError: "Verification challenge failed", 
          turnstileDetail: turnstileResult["error-codes"] 
        })
      };
    }
    
    console.log("Turnstile verification passed");
    
    // 2. Call ZeroBounce API (only if Turnstile verification passed)
    const zerobounceApiKey = process.env.ZEROBOUNCE_API_KEY;
    if (!zerobounceApiKey) {
      throw new Error("ZeroBounce API key not configured");
    }

    // Call ZeroBounce API
    const zerobounceResponse = await fetch(
      `https://api.zerobounce.net/v2/validate?api_key=${zerobounceApiKey}&email=${encodeURIComponent(email)}`
    );
    
    if (!zerobounceResponse.ok) {
      throw new Error(`ZeroBounce API error: ${zerobounceResponse.status}`);
    }

    const zerobounceData = await zerobounceResponse.json();
    
    // 3. Subscribe to Klaviyo List
    const klaviyoApiKey = process.env.KLAVIYO_PUBLIC_API_KEY;
    const klaviyoListId = process.env.KLAVIYO_LIST_ID;

    const klaviyoUrl = `https://a.klaviyo.com/client/subscriptions?company_id=${klaviyoApiKey}`;
    const klaviyoPayload = JSON.stringify({
      data: {
        type: "subscription",
        attributes: {
          profile: {
            data: {
              type: "profile",
              attributes: {
                email: email,
                subscriptions: {
                  email: {
                    marketing: {
                      consent: "SUBSCRIBED",
                      consented_at: new Date().toISOString(),
                    },
                  },
                },
              },
            },
          },
          custom_source: "Coming Soon",
        },
        relationships: {
          list: {
            data: {
              type: "list",
              id: klaviyoListId,
            },
          },
        },
      },
    });

    const klaviyoOptions = {
      method: "POST",
      headers: {
        accept: "application/vnd.api+json",
        "content-type": "application/vnd.api+json",
        revision: "2025-01-15",
      },
      body: klaviyoPayload,
    };

    let klaviyoResult;
    try {
      const klaviyoResponse = await fetch(klaviyoUrl, klaviyoOptions);
      const klaviyoText = await klaviyoResponse.text();
      try {
        klaviyoResult = JSON.parse(klaviyoText);
      } catch {
        klaviyoResult = { message: klaviyoText };
      }
      if (!klaviyoResponse.ok) {
        return {
          statusCode: klaviyoResponse.status,
          headers,
          body: JSON.stringify({
            error: "Klaviyo API error",
            detail: klaviyoResult,
          }),
        };
      }
    } catch (err) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: "Failed to subscribe to Klaviyo",
          detail: err.message,
        }),
      };
    }
    
    // Combine ZeroBounce data with Turnstile success
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ...zerobounceData,
        turnstileSuccess: true,
        klaviyo: klaviyoResult,
      })
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to validate email" })
    };
  }
}; 