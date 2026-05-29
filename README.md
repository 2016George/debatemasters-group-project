## Overview

This is an online debate plaform that allows users of any age to practice and have fun with debate online! You can debate with AI and surprise yourself with a random debate topic and debate opponent！

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## DeepSeek AI Integration

The app now supports real LLM-backed debate behaviors:

- Solo mode opponent replies are generated from DeepSeek via `POST /api/ai/opponent-reply`.
- Debate finalization (winner + Master feedback) is generated via `POST /api/ai/finalize-debate`.
- Arena finalization is idempotent per room and fan-outs judged results to both participants.

Configure these environment variables (see `.env.example`):

```bash
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=...
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL_OPPONENT=deepseek-chat
DEEPSEEK_MODEL_JUDGE=deepseek-reasoner
```

Swap DeepSeek models without changing code by editing:

- `DEEPSEEK_MODEL_OPPONENT`
- `DEEPSEEK_MODEL_JUDGE`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.









