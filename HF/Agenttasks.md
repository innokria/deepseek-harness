```
 i am mounted to a bucket whose path is /data/dsh/ohamlab/addnewporject here write to this location so i can see physicsl file at this location


also all planning work has to be done at path 
/data
/dsh/ohamlab/planning change the path for all future 
/planning-with-files
  tasks it must write to the bucket path


```
## SWARN AGENT

```
/root/r/
├── .planning/              ← planning-skill state (kept at session root so plan tracking stays intact)-> move this to /data/dsh/ohamlab/planningwithfiles folder also set this path for all future /planning-with-files work


/data/dsh/ohamlab/addnewporject/        ← your mounted bucket path
├── ohamlab/            (package: agents, runtime, studio, cli, demo, web)
├── tests/              (10 unit tests)
├── pyproject.toml
├── README.md           (paths updated to the bucket location)
├── .gitignore
└── .ohamlab/           (runtime agent stores)
```
## next work
```
update /free-rahul-model-command  to add new logic for  bundled opencode2api gateway — anonymous free models, no keys as well . prefix it to rahul-opencode-free
```


## Horses
```
/data/dsh/ohamlab/addnewporject/run_melbourne.sh
# Or from workspace:
/root/r/run_melbourne.sh

/data/dsh/ohamlab/addnewporject/run_melbourne.sh --agent 3
# Or:
/data/dsh/ohamlab/addnewporject/run_melbourne.sh --agent 10



/data/dsh/ohamlab/addnewporject/horses_2025.json find the winner


File	Action
/data/dsh/ohamlab/addnewporject/horses_2025.json	JSON horse list with year data (24 runners)
/data/dsh/ohamlab/addnewporject/predict_melbourne.py	Intelligent prediction script
/data/dsh/ohamlab/addnewporject/reports/	Generated .md prediction reports
/data/dsh/ohamlab/addnewporject/horse-list.md	Original markdown format


```
## AGENTS
```
Feature	ohamlab-agents	melbourne-agent
Task Scope	Any independent task	Melbourne Cup 2026 only
Agents	User-specified N independent agents	Single horse racing agent
Reports	Task results + aggregation	Horse racing predictions
Flexibility	General-purpose	Specialized for horse racing
```
