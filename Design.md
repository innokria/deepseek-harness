
## Design 

```
HF Space
   │
   ▼
llama.cpp:full
   │
   ├── /app/llama-server
   ├── llama shared libraries
   │
   ├── LFM2.5-VL-3B.F16.gguf
   └── LFM2.5-VL-3B.F16-mmproj.gguf
   │
   ▼
entrypoint.sh
   │
   ├── llama-server :8000
   │       └── OpenAI-compatible /v1
   │
   ├── DSH :3080
   │       └── local-lfm → LFM2.5
   │
   └── nginx :7860
```


## new
```
HF Space
   │
   ▼
nginx :7860
   │
   ├── /              → DSH :3080
   │
   ├── /api/*         → DSH :3080   ← Settings/Models FIX
   │
   └── /plugins/*     → DSH :3080
                         │
                         ▼
                    DSH / pi-ai
                         │
                         ▼
                 llama provider
                         │
                         ▼
                 llama.cpp :8000
                         │
                         ▼
                    LFM2.5 GGUF
```
