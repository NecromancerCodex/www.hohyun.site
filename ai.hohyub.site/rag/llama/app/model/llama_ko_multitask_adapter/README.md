---
library_name: peft
model_name: llama_ko_multitask_adapter
tags:
- base_model:adapter:C:\Users\jhh72\문서\develop\aiion_project\aiion\langchain\llama\app\model\llama_ko
- lora
- sft
- transformers
- trl
- unsloth
licence: license
pipeline_tag: text-generation
base_model: C:\Users\jhh72\문서\develop\aiion_project\aiion\langchain\llama\app\model\llama_ko
---

# Model Card for llama_ko_multitask_adapter

This model is a fine-tuned version of [None](https://huggingface.co/None).
It has been trained using [TRL](https://github.com/huggingface/trl).

## Quick start

```python
from transformers import pipeline

question = "If you had a time machine, but could only go to the past or the future once and never return, which would you choose and why?"
generator = pipeline("text-generation", model="None", device="cuda")
output = generator([{"role": "user", "content": question}], max_new_tokens=128, return_full_text=False)[0]
print(output["generated_text"])
```

## Training procedure

 


This model was trained with SFT.

### Framework versions

- PEFT 0.18.0
- TRL: 0.24.0
- Transformers: 4.57.3
- Pytorch: 2.9.1+cu126
- Datasets: 4.3.0
- Tokenizers: 0.22.1

## Citations



Cite TRL as:
    
```bibtex
@misc{vonwerra2022trl,
	title        = {{TRL: Transformer Reinforcement Learning}},
	author       = {Leandro von Werra and Younes Belkada and Lewis Tunstall and Edward Beeching and Tristan Thrush and Nathan Lambert and Shengyi Huang and Kashif Rasul and Quentin Gallou{\'e}dec},
	year         = 2020,
	journal      = {GitHub repository},
	publisher    = {GitHub},
	howpublished = {\url{https://github.com/huggingface/trl}}
}
```