# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)


## NEW UPDATE Sept 2026

## Design 
## APP flow
```
                    ┌──────────────────────┐
Internet ──────────►│ nginx :7860          │
                    │ 0.0.0.0              │
                    └──────────┬───────────┘
                               │
                               │ proxy
                               ▼
                    ┌──────────────────────┐
                    │ DSH :3080            │
                    │ 127.0.0.1 ONLY       │
                    └──────────────────────┘
```



```
Internet
    │
    │ HTTP/HTTPS
    ▼
┌──────────────────────────┐
│ nginx :7860              │
│ 0.0.0.0                  │
│ PUBLIC                   │
└────────────┬─────────────┘
             │
             │ reverse proxy
             ▼
┌──────────────────────────┐
│ DSH :3080                │
│ 127.0.0.1 ONLY           │
│ INTERNAL                  │
└──────────────────────────┘
             │
             │ outbound API requests
             ▼
     ┌───────────────────────┐
     │ Remote LLM Providers  │
     ├───────────────────────┤
     │ Groq                  │
     │ Gemini                │
     │ Cerebras              │
     │ SiliconFlow           │
     │ ModelScope            │
     │ Z.ai                  │
     │ DashScope             │
     │ Qianfan               │
     │ Volcengine            │
     │ OpenRouter             │
     │ etc.                  │
     └───────────────────────┘
```
## providers
```
                    DSH
                     │
             Free Provider Pool
                     │
       ┌─────────────┼─────────────┐
       │             │             │
   WESTERN        CHINESE       AGGREGATORS
       │             │             │
     Groq       SiliconFlow    OpenRouter
   Cerebras      ModelScope       LLM7
    Gemini          Z.ai
   Mistral       DashScope
  SambaNova       Qianfan
   Cohere        Volcengine
       │             │
       └─────────────┴─────────────┘
                     │
              Optional providers
                     │
             HF / Agnes / NVIDIA
                     │
              Local llama.cpp
```

## use Docker and start.sh file to load



## Use entrypoint.sh if need LLAMA but now I am not using it
## CUSTOM LLM AGENT  



```
WITH LLAMA CPP and Custom GGUF .  RUNNING ON 2 CORE 16GB CPU 
```

```
DeepSeek Harness + llama.cpp
==========================================================
[DSH] Home:              /data
[DSH] Public port:      7860
[DSH] Internal port:    3080

[LLAMA] Server:         /app/llama-server
[LLAMA] Host:           127.0.0.1
[LLAMA] Port:           8000
[LLAMA] Model:          LFM2.5
[LLAMA] Model path:     /app/LFM2.5-VL-3B-Q4_0.gguf
[LLAMA] MMProj path:    /app/mmproj-LFM2.5-VL-3B-BF16.gguf
[LLAMA] Context:        22288
[LLAMA] Max tokens:     512
[LLAMA] Threads:        2
```

## UI With Ox Alpha
<img width="1408" height="658" alt="image" src="https://github.com/user-attachments/assets/7460b85f-da82-4703-8005-ea2b609a80cc" />



<img width="2349" height="1410" alt="image" src="https://github.com/user-attachments/assets/4f699c11-33cb-4ab0-9548-3b2db811463d" />



```
<img width="2349" height="1410" alt="image" src="https://github.com/user-attachments/assets/0ee7e6ba-751d-4c09-899c-b8b777b6b90f" />

````


## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/deepseek-ai/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## Citation

```bibtex
@misc{deepseek-harness2026,
  title={DeepSeek Harness: Everything is a Plugin},
  author={DeepSeek-AI},
  year={2026},
  publisher={GitHub},
  howpublished={\url{https://github.com/deepseek-ai/deepseek-harness}},
}
```

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
