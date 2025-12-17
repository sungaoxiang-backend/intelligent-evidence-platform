import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.agentic.agents.smart_doc_gen_agent import SmartDocGenAgent

@pytest.fixture
def mock_agent():
    # Mock the internal Agno Agent to avoid real LLM calls
    with patch("app.agentic.agents.smart_doc_gen_agent.Agent") as MockAgentClass:
        mock_agno_agent = AsyncMock()
        MockAgentClass.return_value = mock_agno_agent
        
        # Setup expected response
        mock_response = MagicMock()
        mock_response.content = "Document generated successfully: /tmp/output.docx"
        mock_agno_agent.arun.return_value = mock_response
        
        
        agent = SmartDocGenAgent()
        
        # Verify Agent was initialized with tools
        _, kwargs = MockAgentClass.call_args
        assert "tools" in kwargs
        assert len(kwargs["tools"]) == 1
        assert kwargs["tools"][0] == agent.toolkit
        
        yield agent, mock_agno_agent

@pytest.mark.asyncio
async def test_agent_run(mock_agent):
    agent, mock_agno_agent = mock_agent
    
    case_context = '{"id": 123, "name": "Test Case"}'
    template_path = "/tmp/template.docx"
    output_path = "/tmp/output.docx"
    
    response = await agent.run(case_context, template_path, output_path)
    
    assert "Document generated successfully" in response
    
    # Verify the prompt construction
    args, _ = mock_agno_agent.arun.call_args
    prompt = args[0]
    
    assert "[TEMPLATE PATH]" in prompt
    assert template_path in prompt
    assert "[CASE DATA]" in prompt
    assert case_context in prompt
    assert "[OUTPUT PATH]" in prompt
    assert output_path in prompt
