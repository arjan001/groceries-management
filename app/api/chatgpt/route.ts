import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/api-auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

interface ChatGptSettings {
  model: string;
  enabled: boolean;
  maxTokens: number;
  temperature: number;
}

async function getChatGptSettings(): Promise<ChatGptSettings> {
  const defaults: ChatGptSettings = {
    model: 'gpt-4o-mini',
    enabled: true,
    maxTokens: 2048,
    temperature: 0.7,
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) return defaults;

  try {
    const { data } = await supabase
      .from('business_settings')
      .select('value')
      .eq('key', 'chatGptAi')
      .single();

    if (data?.value) {
      const settings = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
      return {
        model: settings.model || defaults.model,
        enabled: settings.enabled !== false,
        maxTokens: settings.maxTokens || defaults.maxTokens,
        temperature: settings.temperature ?? defaults.temperature,
      };
    }
  } catch {
    // ignore
  }

  return defaults;
}

function getOpenAiConfig() {
  // Netlify AI Gateway auto-injects OPENAI_API_KEY and OPENAI_BASE_URL
  const apiKey = process.env.OPENAI_API_KEY || '';
  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  return { apiKey, baseUrl };
}

// POST: Proxy requests to OpenAI ChatGPT API via Netlify AI Gateway
export async function POST(request: NextRequest) {
  try {
    // Verify the caller is authenticated
    const auth = await verifyAdminAuth(request);
    if (!auth.authenticated) {
      return auth.response;
    }

    const body = await request.json();
    const { prompt, maxOutputTokens, temperature, action } = body as {
      prompt: string;
      maxOutputTokens?: number;
      temperature?: number;
      action?: string;
    };

    const { apiKey, baseUrl } = getOpenAiConfig();

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        message: 'OpenAI API key not available. Ensure the site is deployed on Netlify with AI Gateway enabled, or set OPENAI_API_KEY environment variable.',
      }, { status: 503 });
    }

    // Handle test connection
    if (action === 'test') {
      const settings = await getChatGptSettings();

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: 'user', content: 'Say "Connection successful" in one sentence.' }],
          max_tokens: 50,
        }),
      });

      if (res.ok) {
        return NextResponse.json({ success: true, message: 'ChatGPT AI connection successful! Netlify AI Gateway is active.' });
      } else {
        const err = await res.json().catch(() => ({}));
        return NextResponse.json({
          success: false,
          message: (err as Record<string, Record<string, string>>)?.error?.message || `API error: ${res.status}`,
        }, { status: 502 });
      }
    }

    // Regular content generation
    if (!prompt) {
      return NextResponse.json({ success: false, message: 'Prompt is required' }, { status: 400 });
    }

    const settings = await getChatGptSettings();

    if (!settings.enabled) {
      return NextResponse.json({
        success: false,
        message: 'ChatGPT AI is disabled. Enable it in Settings > ChatGPT AI.',
      }, { status: 403 });
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxOutputTokens || settings.maxTokens,
        temperature: temperature ?? settings.temperature,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({
        success: false,
        message: (err as Record<string, Record<string, string>>)?.error?.message || `ChatGPT API error: ${res.status}`,
      }, { status: 502 });
    }

    const result = await res.json();
    const text = result?.choices?.[0]?.message?.content || '';

    return NextResponse.json({ success: true, text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
