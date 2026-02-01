from fastapi import HTTPException

from app.skill_management import services


def test_list_skills_includes_known_skill():
    skills = services.list_skills()
    assert any(s.id == "rss-article-retriever" for s in skills)


def test_read_skill_file_blocks_path_traversal():
    try:
        services.read_skill_file("rss-article-retriever", "../README.md")
        assert False, "expected HTTPException"
    except HTTPException as e:
        assert e.status_code == 400

