from typing import List, Dict, Any, Optional
import json
from agno.tools import Toolkit

class SmartJsonDocGenToolkit(Toolkit):
    def __init__(self):
        super().__init__(name="smart_json_doc_gen_toolkit")
        self.register(self.extract_structure_from_json)
        self.register(self.fill_json_template)
        # Store for mapping IDs back to JSON paths/nodes if needed, 
        # but for now we will assume the structure is traversed deterministically.

    def extract_structure_from_json(self, content_json: Dict[str, Any]) -> str:
        """
        Extracts the structure (paragraphs and tables) from the ProseMirror JSON.
        Returns a JSON string list of blocks with IDs.
        
        Args:
            content_json: The ProseMirror JSON content.
        """
        try:
            blocks = []
            
            # Helper to traverse recursively
            # structure: "doc" -> content list -> nodes
            # We want to flatten this into a list of fillable items for the LLM
            
            p_counter = 0
            t_counter = 0
            
            if not content_json or "content" not in content_json:
                return json.dumps([], ensure_ascii=False)

            for i, node in enumerate(content_json.get("content", [])):
                node_type = node.get("type")
                
                if node_type == "paragraph":
                    # Extract text from paragraph
                    text_content = ""
                    if "content" in node:
                        for text_node in node.get("content", []):
                            if text_node.get("type") == "text":
                                text_content += text_node.get("text", "")
                    
                    # Even empty paragraphs might be placeholders, but usually we care about text
                    blocks.append({
                        "id": f"p_{p_counter}",
                        "type": "paragraph",
                        "text": text_content
                    })
                    p_counter += 1
                    
                elif node_type == "table":
                    table_data = []
                    # Traverse rows (table -> tableRow -> tableCell/tableHeader -> paragraph -> text)
                    # ProseMirror tables are nested: table -> content (rows) -> content (cells) -> content (blocks like paragraphs)
                    
                    if "content" in node:
                        for r_idx, row in enumerate(node.get("content", [])):
                            if row.get("type") != "tableRow": 
                                continue
                                
                            row_data = []
                            if "content" in row:
                                for c_idx, cell in enumerate(row.get("content", [])):
                                    if cell.get("type") not in ["tableCell", "tableHeader"]:
                                        continue
                                    
                                    # Cells contain blocks, usually paragraphs. We need to join their text.
                                    cell_text = ""
                                    if "content" in cell:
                                        for block in cell.get("content", []):
                                            if block.get("type") == "paragraph" and "content" in block:
                                                for text_node in block.get("content", []):
                                                    if text_node.get("type") == "text":
                                                        cell_text += text_node.get("text", "")
                                                cell_text += "\n" # Separate paragraphs in cell with newline
                                    
                                    row_data.append({
                                        "id": f"t_{t_counter}_r{r_idx}_c{c_idx}",
                                        "text": cell_text.strip()
                                    })
                            table_data.append(row_data)
                            
                    blocks.append({
                        "id": f"t_{t_counter}",
                        "type": "table",
                        "rows": table_data
                    })
                    t_counter += 1

            return json.dumps(blocks, ensure_ascii=False, indent=2)
        except Exception as e:
            return json.dumps({"error": str(e)})

    def fill_json_template(self, content_json: Dict[str, Any], fillings_json: str) -> Dict[str, Any]:
        """
        Fills the ProseMirror JSON template with provided content.
        Returns the modified JSON object.
        
        Args:
            content_json: The original ProseMirror JSON.
            fillings_json: JSON string mapping block IDs to new content.
        """
        try:
            fillings = json.loads(fillings_json)
            # Deep copy to avoid mutating original if passed by ref (though in API usually it's fine)
            import copy
            new_content = copy.deepcopy(content_json)
            
            p_counter = 0
            t_counter = 0
            
            if "content" not in new_content:
                return new_content
                
            for node in new_content.get("content", []):
                node_type = node.get("type")
                
                if node_type == "paragraph":
                    pid = f"p_{p_counter}"
                    if pid in fillings:
                        val = fillings[pid]
                        # Safety: If value is empty, ignore it (do not overwrite/delete)
                        if not val:
                            continue
                        # Get current text
                        current_text = ""
                        if "content" in node:
                            for text_node in node.get("content", []):
                                if text_node.get("type") == "text":
                                    current_text += text_node.get("text", "")
                        
                        # Smart Append Logic
                        if val.startswith(current_text) and len(current_text) > 0:
                            diff = val[len(current_text):]
                            if diff:
                                # Append a new text node with default styling (or inherit last?)
                                # Inheriting last node's marks is usually safer for consistency
                                marks = []
                                if "content" in node and len(node["content"]) > 0:
                                     # Try to get marks from the last text node
                                     last_node = node["content"][-1]
                                     if last_node.get("type") == "text":
                                         marks = last_node.get("marks", [])
                                
                                # Add new text node
                                if "content" not in node:
                                    node["content"] = []
                                node["content"].append({
                                    "type": "text",
                                    "text": diff,
                                    "marks": marks
                                })
                        else:
                            # Overwrite
                            # We replace all content with a single text node, preserving marks of the first node if possible?
                            # Or just raw text? Agent instruction says "don't modify original", so overwrite typically implies 
                            # replacing the *value* but maybe we should keep the style of the start.
                            # BUT, for "Fill Only", we typically only append. 
                            # If we MUST overwrite (e.g. placeholder was "____" and we replace with "Value"), 
                            # we should try to keep the style.
                            
                            marks = []
                            if "content" in node and len(node["content"]) > 0:
                                first_node = node["content"][0]
                                if first_node.get("type") == "text":
                                    marks = first_node.get("marks", [])
                                    
                            node["content"] = [{
                                "type": "text",
                                "text": val,
                                "marks": marks 
                            }]
                            
                    p_counter += 1
                    
                elif node_type == "table":
                    tid = f"t_{t_counter}"
                    # Iterate rows
                    if "content" in node:
                        for r_idx, row in enumerate(node.get("content", [])):
                            if row.get("type") != "tableRow": continue
                            
                            if "content" in row:
                                for c_idx, cell in enumerate(row.get("content", [])):
                                    if cell.get("type") not in ["tableCell", "tableHeader"]: continue
                                    
                                    cid = f"{tid}_r{r_idx}_c{c_idx}"
                                    if cid in fillings:
                                        val = fillings[cid]
                                        
                                        # Safety: If value is empty, ignore it (do not overwrite/delete)
                                        if not val:
                                            continue
                                        
                                        # Get current text to check for smart append
                                        cell_text = ""
                                        last_paragraph = None
                                        
                                        # We need to reconstruct the full text of the cell to compare
                                        if "content" in cell:
                                            for block in cell.get("content", []):
                                                if block.get("type") == "paragraph":
                                                    last_paragraph = block
                                                    if "content" in block:
                                                        for text_node in block.get("content", []):
                                                            if text_node.get("type") == "text":
                                                                cell_text += text_node.get("text", "")
                                                    cell_text += "\n"
                                        
                                        cell_text = cell_text.strip()
                                        
                                        if val.startswith(cell_text) and len(cell_text) > 0:
                                            # Smart Append
                                            diff = val[len(cell_text):]
                                            if diff:
                                                # Append to the LAST paragraph of the cell
                                                if last_paragraph:
                                                    marks = []
                                                    if "content" in last_paragraph and len(last_paragraph["content"]) > 0:
                                                        last_node = last_paragraph["content"][-1]
                                                        if last_node.get("type") == "text":
                                                            marks = last_node.get("marks", [])
                                                    
                                                    if "content" not in last_paragraph:
                                                        last_paragraph["content"] = []
                                                    
                                                    last_paragraph["content"].append({
                                                        "type": "text",
                                                        "text": diff,
                                                        "marks": marks
                                                    })
                                                else:
                                                    # No paragraph? Create one
                                                    cell["content"] = cell.get("content", [])
                                                    cell["content"].append({
                                                        "type": "paragraph",
                                                        "content": [{
                                                            "type": "text",
                                                            "text": diff
                                                        }]
                                                    })
                                        else:
                                            # Overwrite: Replace cell content with a single paragraph containing the value
                                            # Try to preserve style if possible from the first paragraph's first text node
                                            marks = []
                                            if "content" in cell and len(cell["content"]) > 0:
                                                first_p = cell["content"][0]
                                                if first_p.get("type") == "paragraph" and "content" in first_p and len(first_p["content"]) > 0:
                                                    first_node = first_p["content"][0]
                                                    if first_node.get("type") == "text":
                                                        marks = first_node.get("marks", [])
                                                        
                                            cell["content"] = [{
                                                "type": "paragraph",
                                                "content": [{
                                                    "type": "text",
                                                    "text": val,
                                                    "marks": marks
                                                }]
                                            }]

                    t_counter += 1
            
            return new_content
        except Exception as e:
            # In case of error, return original structure with error logged? 
            # Or re-raise? For agent safety, let's return original and log.
            print(f"Error filling JSON template: {str(e)}")
            return content_json
