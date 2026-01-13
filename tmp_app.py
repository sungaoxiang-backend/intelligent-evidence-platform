import os
import uvicorn
import json
from fastapi import FastAPI, Request, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
from claude_agent_sdk import ClaudeSDKClient, ClaudeAgentOptions
from claude_agent_sdk.types import (
    AssistantMessage,
    TextBlock,
    ThinkingBlock,
    ResultMessage,
    UserMessage,
)

app = FastAPI()

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

class ChatRequest(BaseModel):
    message: str
    session_id: str
    skills: list[str] = []
    images: Optional[List[str]] = None

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    upload_dir = os.path.join(os.getcwd(), "uploads")
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, file.filename)
    try:
        with open(file_path, "wb") as f:
            f.write(await file.read())
        return {"status": "success", "path": file_path, "filename": file.filename}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.get("/api/skills")
async def list_skills():
    skills_dir = os.path.join(os.getcwd(), ".claude", "skills")
    if not os.path.exists(skills_dir):
        return {"skills": []}
    
    skills = [
        d for d in os.listdir(skills_dir)
        if os.path.isdir(os.path.join(skills_dir, d)) and not d.startswith('.')
    ]
    return {"skills": sorted(skills)}

@app.post("/api/skills")
async def upload_skill(file: UploadFile = File(...)):
    skills_dir = os.path.join(os.getcwd(), ".claude", "skills")
    os.makedirs(skills_dir, exist_ok=True)
    
    # Save uploaded zip temporarily
    temp_zip_path = os.path.join(skills_dir, file.filename)
    try:
        with open(temp_zip_path, "wb") as f:
            f.write(await file.read())
            
        # Extract
        import zipfile
        with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
            # Analyze zip structure to avoid nesting
            top_level_items = {item.filename.split('/')[0] for item in zip_ref.infolist() if item.filename.split('/')[0]}
            
            if len(top_level_items) == 1:
                zip_ref.extractall(skills_dir)
            else:
                 skill_name = os.path.splitext(file.filename)[0]
                 extract_path = os.path.join(skills_dir, skill_name)
                 os.makedirs(extract_path, exist_ok=True)
                 zip_ref.extractall(extract_path)

        # Cleanup zip
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
            
        return {"status": "success", "message": f"Skill {file.filename} uploaded."}
            
    except Exception as e:
        return {"status": "error", "message": str(e)}

class CreateSkillRequest(BaseModel):
    name: str
    description: str
    instructions: str

@app.post("/api/skills/create")
async def create_skill(request: CreateSkillRequest):
    import re
    if not re.match(r'^[a-zA-Z0-9_\-]+$', request.name):
        return {"status": "error", "message": "Invalid skill name."}
    
    skills_dir = os.path.join(os.getcwd(), ".claude", "skills")
    skill_path = os.path.join(skills_dir, request.name)
    
    if os.path.exists(skill_path):
        return {"status": "error", "message": "Skill already exists."}
    
    try:
        os.makedirs(skill_path, exist_ok=True)
        content = f"---\nname: {request.name}\ndescription: {request.description}\n---\n\n{request.instructions}\n"
        with open(os.path.join(skill_path, "SKILL.md"), "w") as f:
            f.write(content)
        return {"status": "success", "message": f"Skill {request.name} created."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.delete("/api/skills/{skill_name}")
async def delete_skill(skill_name: str):
    import shutil
    skills_dir = os.path.join(os.getcwd(), ".claude", "skills")
    skill_path = os.path.join(skills_dir, skill_name)
    if os.path.exists(skill_path):
        shutil.rmtree(skill_path)
        return {"status": "success"}
    return {"status": "error", "message": "Not found"}


# ============ Agent Prompt API ============

PROMPT_FILE_PATH = os.path.join(os.getcwd(), "CLAUDE.md")

@app.get("/api/prompt")
async def get_prompt():
    """Read the agent prompt from CLAUDE.md"""
    try:
        if os.path.exists(PROMPT_FILE_PATH):
            with open(PROMPT_FILE_PATH, "r", encoding="utf-8") as f:
                content = f.read()
            return {"status": "success", "content": content}
        else:
            return {"status": "success", "content": ""}
    except Exception as e:
        return {"status": "error", "message": str(e)}


class SavePromptRequest(BaseModel):
    content: str


@app.post("/api/prompt")
async def save_prompt(request: SavePromptRequest):
    """Save the agent prompt to CLAUDE.md"""
    try:
        with open(PROMPT_FILE_PATH, "w", encoding="utf-8") as f:
            f.write(request.content)
        return {"status": "success", "message": "Prompt saved successfully."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


async def chat_generator(prompt: str, session_id: str, skills: list[str] = []):
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    env_vars = os.environ.copy()
    if "ANTHROPIC_AUTH_TOKEN" in os.environ and "ANTHROPIC_API_KEY" not in os.environ:
         env_vars["ANTHROPIC_API_KEY"] = os.environ["ANTHROPIC_AUTH_TOKEN"]

    # Session Isolation Strategy:
    project_root = os.getcwd()
    session_dir = os.path.join(project_root, ".claude_sessions", session_id)
    os.makedirs(session_dir, exist_ok=True)
    
    # SDK-Native Configuration:
    # CLAUDE.md in project root defines the agent's instructions
    # setting_sources=['project'] enables reading CLAUDE.md

    # Dynamic Skill Management (Copy Strategy)
    # We construct a session-specific .claude/skills directory containing ONLY active skills.
    target_claude = os.path.join(session_dir, ".claude")
    target_skills_dir = os.path.join(target_claude, "skills")
    source_skills_dir = os.path.join(project_root, ".claude", "skills")
    
    # Ensure .claude/skills structure exists in session dir
    os.makedirs(target_skills_dir, exist_ok=True)
    
    # 1. Clear existing skills in session dir to ensure clean state
    if os.path.exists(target_skills_dir):
        import shutil
        shutil.rmtree(target_skills_dir)
        os.makedirs(target_skills_dir, exist_ok=True)

    # 2. Copy ONLY the active skills from request
    if skills and os.path.exists(source_skills_dir):
        for skill_name in skills:
            source_skill_path = os.path.join(source_skills_dir, skill_name)
            target_skill_path = os.path.join(target_skills_dir, skill_name)
            
            if os.path.exists(source_skill_path):
                # Copy the directory (dereference symlinks if source has them, but source is likely real)
                try:
                    shutil.copytree(source_skill_path, target_skill_path, symlinks=True)
                except Exception as e:
                    print(f"Failed to copy skill {skill_name}: {e}")
    
    # Symlink other config files from .claude if needed (e.g. config.json)
    # logic here if we had other files in .claude root


    # Initialize SDK options with Official Skills Support
    # setting_sources=["project"] enables loading skills from .claude/skills (in cwd)
    # allowed_tools=["Skill", ...] enables the Skill tool and standard tools
    
    # SDK will automatically load CLAUDE.md from project_root because:
    # 1. cwd=session_dir (SDK searches parent dirs for CLAUDE.md)
    # 2. add_dirs=[project_root] (explicitly includes project root)
    # 3. setting_sources=['project'] (enables project-level config)
    
    agent_options_kwargs = {
        "env": env_vars,
        "cwd": session_dir,
        "add_dirs": [project_root],
        "setting_sources": ["project"],  # CRITICAL: Enables CLAUDE.md loading
        "allowed_tools": ["Skill", "computer", "bash", "text_editor"],
        "continue_conversation": True,
        "include_partial_messages": True,
        "max_thinking_tokens": 8000  # 降低thinking预算以加快响应（原20000）
    }

    options = ClaudeAgentOptions(**agent_options_kwargs)
    
    async with ClaudeSDKClient(options) as client:
        try:
            # Send the query
            await client.query(prompt, session_id=session_id)
            
            # Receive the response stream
            from claude_agent_sdk.types import StreamEvent, ResultMessage
            
            async for msg in client.receive_response():
                if isinstance(msg, StreamEvent):
                    event = msg.event
                    print(f"DEBUG EVENT: {event}") # <--- Added Debug Log
                    event_type = event.get("type")

                    if event_type == "content_block_start":
                        content_block = event.get("content_block", {})
                        block_type = content_block.get("type")
                        
                        if block_type == "tool_use":
                            tool_name = content_block.get("name", "unknown_tool")
                            tool_id = content_block.get("id", "")
                            # Send tool_use event with tool name
                            yield f"data: {json.dumps({'type': 'tool_use', 'name': tool_name, 'id': tool_id})}\n\n"
                        elif block_type == "tool_result":
                            # Tool result content
                            tool_use_id = content_block.get("tool_use_id", "")
                            content = content_block.get("content", "")
                            if isinstance(content, list):
                                # Extract text from content blocks
                                text_parts = [c.get("text", "") for c in content if c.get("type") == "text"]
                                content = "\n".join(text_parts)
                            yield f"data: {json.dumps({'type': 'tool_result', 'tool_use_id': tool_use_id, 'content': str(content)[:500]})}\n\n"
                    
                    elif event_type == "content_block_delta":
                        delta = event.get("delta", {})
                        delta_type = delta.get("type")
                        
                        if delta_type == "thinking_delta":
                            text = delta.get("thinking", "")
                            if text:
                                yield f"data: {json.dumps({'type': 'thinking', 'content': text})}\n\n"
                        elif delta_type == "input_json_delta":
                            # This is tool input JSON - send as tool_input type
                            partial_json = delta.get("partial_json", "")
                            if partial_json:
                                yield f"data: {json.dumps({'type': 'tool_input', 'content': partial_json})}\n\n"
                        elif delta_type == "text_delta":
                            text = delta.get("text", "")
                            if text:
                                yield f"data: {json.dumps({'type': 'text', 'content': text})}\n\n"

                    elif event_type == "content_block_stop":
                        # Signal the end of a content block
                        yield f"data: {json.dumps({'type': 'block_stop'})}\n\n"
                                
                elif isinstance(msg, ResultMessage):
                    yield f"data: {json.dumps({'type': 'done'})}\n\n"
                    break
                    
        except Exception as e:
            error_msg = f"Error: {str(e)}"
            yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    return StreamingResponse(
        chat_generator(request.message, request.session_id, request.skills),
        media_type="text/event-stream"
    )


@app.get("/")
async def read_root():
    from fastapi.responses import FileResponse
    return FileResponse("static/index.html")

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
