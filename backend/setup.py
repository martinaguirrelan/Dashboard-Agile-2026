from setuptools import setup, find_packages

setup(
    name="dashboard-agile-2026",
    version="1.0.0",
    description="FastAPI backend for Dashboard Agile 2026",
    packages=find_packages(),
    python_requires=">=3.11",
    install_requires=[
        "fastapi>=0.115.0",
        "uvicorn[standard]>=0.30.0",
        "pydantic[email]>=2.10.0",
        "pydantic-settings>=2.6.0",
        "python-dotenv>=1.0.0",
        "sqlalchemy>=2.0.0",
        "psycopg2-binary>=2.9.0",
        "supabase>=2.6.0",
        "python-multipart>=0.0.9",
        "python-jose[cryptography]>=3.3.0",
        "bcrypt>=4.0.0",
        "httpx>=0.27.0",
        "apscheduler>=3.10.0",
    ],
)
