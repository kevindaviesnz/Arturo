# Getting started

How to install Arturo and confirm it runs. Once it starts, go to
[Your first Enterprise](../../docs/Chapter_3_Your_First_Enterprise.md).

Arturo is open-source, pre-release software that runs on your computer. The
terminal interface is designed for one operator.

## What you need

- a current version of Node.js;
- npm, which comes with Node.js; and
- Ollama if you want to use a local AI model.

## 1. Install Arturo

From the `cli` directory:

```bash
npm install
npm run build
npm run test:run
```

All tests should pass. If the build or tests fail, fix that before using Arturo
for a demonstration.

## 2. Create your private settings file

Copy the safe example:

```bash
cp .env.example .env
```

The new `.env` file is ignored by Git. It is where your private settings and
API keys belong.

Some secure features need secret values. Use four different random values.
Each must be at least 32 characters:

```dotenv
APPROVAL_SIGNING_SECRET=<random non-placeholder value>
HUMAN_TASK_TOKEN_SECRET=<different random non-placeholder value>
RUNTIME_REPLAY_ATTESTATION_SECRET=<different random non-placeholder value>
API_SECRET_ENCRYPTION_KEY=<different random non-placeholder value>
ARTURO_HTTP_ALLOWED_HOSTS=
```

Do not commit, share, or reuse these secrets.

For server-style use, `APPROVAL_SIGNING_SECRET_FILE` may point to a private
file outside Arturo's data directory instead of putting the approval signing
secret directly in `.env`.

Arturo stops secure signing features when a required secret is missing. This
is safer than silently using a weak default.

Everything else in `.env` is optional and off by default. See
[Configuration](./configuration.md) for outbound web access, governed Web
Search, network addresses, and headless operation.

## 3. Start the local AI model

Arturo needs a model to do its thinking. If you use Ollama:

```bash
ollama pull llama3.2:latest
ollama serve
```

If the Ollama app is already running, `ollama serve` may say that the address
is in use. That usually means the service is ready already.

Your `.env` should include:

```dotenv
ARTURO_LLM_PROVIDER=ollama
ARTURO_LLM_MODEL=llama3.2:latest
ARTURO_LLM_ROUTING_MODE=local-first
```

You can change the model later from inside Arturo with `/model`. Nothing paid
is ever used unless you choose it there and confirm the cost.

## 4. Start Arturo

```bash
npm run ui
```

You should get the `arturo ›` prompt. Check it works:

```text
/help
```

`/help` lists the commands by purpose, and `/help <command>` explains one in
full. The same list is written down in the
[command reference](./command-reference.md).

To stop Arturo, type `/exit`.

## Installed. What now?

Go to [Your first Enterprise](../../docs/Chapter_3_Your_First_Enterprise.md)
and set up a business.

Commands in the lessons are written without the `arturo ›` prompt. Type only
the command.
