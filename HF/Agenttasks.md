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
├── .planning/              ← planning-skill state (kept at session root so plan tracking stays intact)
└── dsh/ohamlab/            ← new parent working dir
    └── app/                ← all the code lives here
        ├── ohamlab/            (package: agents, runtime, studio, cli, demo, web)
        ├── tests/              (10 unit tests)
        ├── pyproject.toml
        ├── README.md           (paths updated)
        ├── .gitignore
        └── .ohamlab/           (runtime agent stores)
```
