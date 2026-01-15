# UK Carbon Intensity Dashboard: A Full-Stack, ML-Enhanced Energy Optimization System



---

## Abstract

This repository contains the source code and technical documentation for a full-stack web application designed to provide real-time insights into the United Kingdom's national and regional energy grid carbon intensity. The system leverages a machine learning model to analyze time-series forecast data, generating intelligent recommendations for optimizing energy consumption by identifying periods of low carbon intensity. This project serves as a demonstration of robust software engineering principles, including a decoupled microservices architecture, modern DevOps practices, and the integration of a complete machine learning inference pipeline into a production-style web service. The entire application is containerized, tested, and features a continuous integration pipeline to ensure code quality and reliability.

---

## 1. System Architecture & Engineering Principles

The application is architected as a containerized, multi-service system with a strict separation of concerns between the user interface and the backend API. This design promotes scalability, maintainability, and independent development cycles.

-   **Core Technologies:**
    -   **Frontend:** React.js, Chart.js for interactive data visualization.
    -   **Backend:** Python 3.10+, FastAPI for high-performance asynchronous API development, scikit-learn and pandas for the machine learning inference pipeline.
    -   **DevOps & Tooling:** Docker and Docker Compose for containerization and service orchestration, GitHub Actions for Continuous Integration (CI), Pytest and React Testing Library for automated testing, and a suite of static analysis tools (`black`, `isort`, `flake8`, `prettier`) for enforced code quality.

-   **Architectural Diagram:**
    ```mermaid
    graph TD
        A[User] -->|Browser Interaction| B(Frontend Service: React.js on NGINX);
        B -->|API Request /api/v1/...| C(Backend Service: FastAPI on Uvicorn);
        C -->|Data Fetching| D[External API: National Grid ESO];
        C -->|ML Inference| E(Model Artifacts: *.pkl);
        D -->|JSON Response| C;
        E -->|Inference Result| C;
        C -->|JSON Response| B;
    ```

-   **Structural Design:**
    -   **Decoupled Services:** The frontend (React) and backend (Python) operate as independent services within a Docker network, communicating exclusively via a well-defined RESTful API. This microservices-like pattern is fundamental to modern, scalable web applications.
    -   **Backend Logic Segregation:** The FastAPI backend employs a clean architectural pattern, separating the API routing layer (`api_router.py`) from the core business logic and machine learning inference layer (`services.py`).
    -   **Version Control:** The project is managed under Git. The `.gitignore` is meticulously configured to exclude environment-specific files (`.env`, `venv/`), compiled artifacts (`__pycache__/`), large data files (`data/`), and trained models (`models/`), ensuring a lean repository focused on source code.

---

## 2. Operational Guide for Local Deployment

To run a local instance of this system for development or evaluation, the following steps are required.

### Prerequisites
-   Git
-   Docker Engine
-   Docker Compose

### Installation & Execution
1.  **Clone the Repository:**
    ```bash
    git clone https://github.com/<YourUsername>/<YourRepoName>.git
    cd <YourRepoName>
    ```

2.  **Environment Configuration:**
    The backend service is configured via environment variables. For local execution, a `.env` file is used.
    ```bash
    # Create a .env file in the backend/ directory from the provided template.
    cp backend/.env.example backend/.env
    ```
    *Note: The default values in the `.env.example` file are sufficient for local operation.*

3.  **Build and Launch Services:**
    Use Docker Compose to build the container images and orchestrate the launch of all services.
    ```bash
    docker-compose up --build
    ```

4.  **Access Points:**
    -   **Frontend User Interface:** `http://localhost:3000`
    -   **Backend API Interactive Documentation (Swagger UI):** `http://localhost:8000/docs`

---

## 3. Quality Assurance, Automation, and CI/CD

A primary objective of this project is to demonstrate professional-grade software development practices. This is achieved through a multi-layered approach to quality assurance and automation.

### Static Analysis & Code Quality
The codebase is enforced to a single, consistent standard using a suite of linters and formatters. These are managed and automated via **pre-commit hooks**.
-   **Tools:** `black`, `isort`, `flake8` (Python); `prettier`, `eslint` (JavaScript/React).
-   **Execution:** These checks are run automatically before each Git commit to prevent inconsistent or erroneous code from entering the version history. They can also be run manually:
    ```bash
    pre-commit run --all-files
    ```

### Automated Testing
The system includes a comprehensive, multi-layered automated testing suite to guarantee functional correctness and prevent regressions.
-   **Backend Testing (Pytest):** The backend features a suite of unit and integration tests. External API calls are mocked using `pytest-mock` to ensure deterministic and fast test execution.
    ```bash
    # Execute backend tests from the project root
    pytest backend/
    ```
-   **Frontend Testing (React Testing Library):** The frontend components and custom hooks are validated with unit tests to ensure correct rendering and behavior.
    ```bash
    # Execute frontend tests via the running Docker container
    docker-compose exec frontend npm test -- --watchAll=false
    ```

### Continuous Integration (CI) Pipeline
A Continuous Integration pipeline is configured using **GitHub Actions** (`.github/workflows/ci.yml`). This workflow is triggered on every `push` and `pull_request` and performs the following sequence of automated jobs:
1.  **Code Quality Verification:** Installs dependencies and runs all linter and formatter checks.
2.  **Automated Testing:** Executes the complete Pytest and React Testing Library suites.
3.  **Build Verification:** Builds fresh Docker images for both frontend and backend services to confirm that the application's build process is functional.
A failure at any stage will halt the pipeline and prevent the merging of defective code.

---

## 4. Machine Learning Inference Pipeline

The intelligent recommendation feature is powered by a K-Means clustering model designed to categorize different types of low-carbon "windows."

-   **Objective:** To classify periods of low carbon intensity based not only on their absolute value but also on their temporal characteristics.
-   **Feature Engineering:** The model is trained on three engineered features derived from historical time-series data for each identified low-carbon window:
    1.  **`duration`:** The total length of the continuous low-intensity period in minutes.
    2.  **`depth`:** The normalized difference between the window's average intensity and the daily mean intensity.
    3.  **`stability`:** The standard deviation of intensity values within the window, measuring volatility.
-   **Model Architecture:** `sklearn.cluster.KMeans` with `n_clusters=3` was selected for its efficiency and the high interpretability of its resulting clusters. Each cluster is deterministically mapped to a specific "appliance profile" (e.g., "Heavy Load Shift," "Standard Green Window," "Quick Green Burst").
-   **Model Training & Artifact Generation:** The complete pipeline for regenerating the model artifacts is encapsulated in two scripts:
    1.  `backend/data_collector.py`: Fetches and stores the latest historical data required for training.
    2.  `backend/create_model_artifacts.py`: Processes the raw data, engineers features, trains a new `StandardScaler` and `KMeans` model, and serializes them as `.pkl` artifacts.
    To retrain the model, these scripts should be executed in sequence.

---

## 5. System API Endpoints

The backend exposes a RESTful API with endpoints under the `/api/v1` prefix. Interactive documentation is available via the Swagger UI at `http://localhost:8000/docs`.

| Method | Path                                                  | Description                                                                                             |
|--------|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `GET`  | `/regions`                                            | Retrieves a list of all canonical UK grid regions.                                                      |
| `GET`  | `/intensity/forecast/48h`                             | Retrieves the 48-hour national carbon intensity forecast.                                               |
| `GET`  | `/intensity/regional/forecast/48h/{region_shortname}` | Retrieves the 48-hour forecast for a specified region.                                                  |
| `GET`  | `/optimizer/appliance-recommendations`                | **Core Endpoint.** Executes the ML pipeline to generate appliance usage recommendations. Accepts an optional `region_shortname` query parameter to toggle between national and regional analysis. |

---

## 6. Future Work & Scalability Considerations

While this project demonstrates a robust, end-to-end system, several enhancements are identified for a production-scale deployment:

1.  **Continuous Deployment (CD):** The CI pipeline should be extended to include a CD stage, automating the deployment of validated Docker images to a cloud infrastructure provider (e.g., AWS ECS, Google Cloud Run).
2.  **Database Integration:** The current use of a CSV file for historical data and an in-memory cache should be upgraded. A production deployment would utilize a dedicated database (e.g., PostgreSQL) for storing historical data and a distributed cache like Redis for improved performance and state management.
3.  **User Authentication & Personalization:** The system could be extended to include user accounts, allowing for the storage of personalized appliance profiles and the delivery of targeted notifications.
4.  **Asynchronous Task Queue:** For more computationally intensive tasks (e.g., periodic model retraining), an asynchronous task queue (e.g., Celery with RabbitMQ/Redis) should be implemented to offload work from the main API process.
