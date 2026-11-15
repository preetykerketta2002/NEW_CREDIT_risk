"""Create the MySQL schema and seed the bundled data on first deployment."""
import csv
from pathlib import Path

from sqlalchemy import text

from ml.api import engine

ROOT = Path(__file__).resolve().parents[1]

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS entities (
      entity_id VARCHAR(50) NOT NULL PRIMARY KEY,
      entity_name VARCHAR(255) NOT NULL,
      sector VARCHAR(100), country VARCHAR(100),
      revenue_usd_m DECIMAL(12,2), ebitda_margin_pct DECIMAL(5,2), ebit_margin_pct DECIMAL(5,2),
      cash_usd_m DECIMAL(12,2), total_assets_usd_m DECIMAL(12,2), equity_usd_m DECIMAL(12,2),
      net_debt_usd_m DECIMAL(12,2), debt_to_equity DECIMAL(8,4), interest_expense_usd_m DECIMAL(12,2),
      interest_coverage DECIMAL(8,4), operating_cf_usd_m DECIMAL(12,2), capex_usd_m DECIMAL(12,2),
      fcf_usd_m DECIMAL(12,2), dscr DECIMAL(8,4), current_ratio DECIMAL(8,4), quick_ratio DECIMAL(8,4),
      dso_days INT, dpo_days INT, dio_days INT, revenue_cagr_3y_pct DECIMAL(5,2), years_in_operation INT,
      ownership_type VARCHAR(50), auditor_tier VARCHAR(50), governance_score_0_100 INT,
      esg_controversies_3y INT, country_risk_0_100 INT, industry_cyclicality VARCHAR(50),
      fx_revenue_pct DECIMAL(5,2), hedging_policy VARCHAR(50), collateral_coverage_pct DECIMAL(5,2),
      covenant_quality VARCHAR(50), payment_incidents_12m INT, legal_disputes_open INT,
      sanctions_exposure VARCHAR(50), financials_audited VARCHAR(10),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS credit_outcomes (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, entity_id VARCHAR(50) NOT NULL UNIQUE,
      pd_1y_pct DECIMAL(8,4), lgd_pct DECIMAL(8,4), ead_usd_m DECIMAL(12,2),
      risk_bucket ENUM('Low','Medium','High') NOT NULL, implied_rating VARCHAR(20),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_credit_outcome_entity FOREIGN KEY (entity_id) REFERENCES entities(entity_id) ON DELETE CASCADE
    ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS factor_thresholds (
      threshold_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, factor_key VARCHAR(150) NOT NULL,
      start_range DECIMAL(20,4), end_range DECIMAL(20,4),
      evaluation ENUM('Low','Medium','High') NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_factor_thresholds_factor_key (factor_key)
    ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS evaluations (
      evaluation_id CHAR(36) NOT NULL PRIMARY KEY,
      entity_id VARCHAR(50) NOT NULL,
      evaluation_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      low_count INT DEFAULT 0, medium_count INT DEFAULT 0, high_count INT DEFAULT 0,
      is_red_flag_triggered TINYINT(1) DEFAULT 0, red_flag_reasons JSON, summary TEXT,
      final_evaluation ENUM('Low','Medium','High') NOT NULL,
      CONSTRAINT fk_evaluation_entity FOREIGN KEY (entity_id) REFERENCES entities(entity_id) ON DELETE CASCADE
    ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS factor_evaluations (
      factor_eval_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      evaluation_id CHAR(36) NOT NULL, factor_key VARCHAR(100) NOT NULL,
      raw_value DECIMAL(12,4), evaluation ENUM('Low','Medium','High') NOT NULL,
      CONSTRAINT fk_factor_evaluation_evaluation FOREIGN KEY (evaluation_id) REFERENCES evaluations(evaluation_id) ON DELETE CASCADE
    ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS app_users (
      user_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE, full_name VARCHAR(120) NOT NULL,
      password_hash VARCHAR(512) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS auth_sessions (
      session_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id BIGINT NOT NULL,
      token_hash CHAR(64) NOT NULL UNIQUE, expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_auth_sessions_user_id (user_id),
      CONSTRAINT fk_auth_session_user FOREIGN KEY (user_id) REFERENCES app_users(user_id) ON DELETE CASCADE
    ) ENGINE=InnoDB""",
    """CREATE TABLE IF NOT EXISTS search_history (
      search_id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT NULL, search_query VARCHAR(255) NOT NULL,
      searched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_search_history_user_query (user_id, search_query),
      INDEX idx_search_history_searched_at (searched_at)
    ) ENGINE=InnoDB""",
]


def as_number(value):
    value = (value or "").strip()
    return None if value == "" else float(value)


def seed_entities(connection):
    source = ROOT / "data" / "credit_risk_dataset_50_entities.csv"
    excluded = {"PD_1y_pct", "LGD_pct", "EAD_usd_m", "risk_bucket", "implied_rating"}
    with source.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            entity = {key: (value.strip() or None) for key, value in row.items() if key not in excluded}
            columns = list(entity)
            sql = f"INSERT INTO entities ({','.join(columns)}) VALUES ({','.join(':'+key for key in columns)})"
            connection.execute(text(sql), entity)
            if row.get("risk_bucket"):
                connection.execute(text("""INSERT INTO credit_outcomes
                    (entity_id,pd_1y_pct,lgd_pct,ead_usd_m,risk_bucket,implied_rating)
                    VALUES (:entity_id,:pd,:lgd,:ead,:bucket,:rating)"""), {
                    "entity_id": row["entity_id"], "pd": as_number(row.get("PD_1y_pct")),
                    "lgd": as_number(row.get("LGD_pct")), "ead": as_number(row.get("EAD_usd_m")),
                    "bucket": row["risk_bucket"], "rating": row.get("implied_rating") or None,
                })


def seed_thresholds(connection):
    source = ROOT / "data" / "factor_thresholds_evaluator_global-truth.csv"
    with source.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            connection.execute(text("""INSERT INTO factor_thresholds
                (factor_key,start_range,end_range,evaluation) VALUES (:factor,:start,:end,:evaluation)"""), {
                "factor": row["factor"].strip(), "start": as_number(row.get("start_range")),
                "end": as_number(row.get("end_range")), "evaluation": row["evaluation"].strip(),
            })


def main():
    with engine.begin() as connection:
        for statement in SCHEMA:
            connection.execute(text(statement))
        if connection.execute(text("SELECT COUNT(*) FROM entities")).scalar() == 0:
            seed_entities(connection)
        elif connection.execute(text("SELECT COUNT(*) FROM credit_outcomes")).scalar() == 0:
            # Fill historical outcomes for an already-imported entity set.
            source = ROOT / "data" / "credit_risk_dataset_50_entities.csv"
            with source.open(encoding="utf-8-sig", newline="") as file:
                for row in csv.DictReader(file):
                    if row.get("risk_bucket"):
                        connection.execute(text("""INSERT IGNORE INTO credit_outcomes
                            (entity_id,pd_1y_pct,lgd_pct,ead_usd_m,risk_bucket,implied_rating)
                            VALUES (:entity_id,:pd,:lgd,:ead,:bucket,:rating)"""), {
                            "entity_id": row["entity_id"], "pd": as_number(row.get("PD_1y_pct")),
                            "lgd": as_number(row.get("LGD_pct")), "ead": as_number(row.get("EAD_usd_m")),
                            "bucket": row["risk_bucket"], "rating": row.get("implied_rating") or None,
                        })
        if connection.execute(text("SELECT COUNT(*) FROM factor_thresholds")).scalar() == 0:
            seed_thresholds(connection)
    print("FastAPI database schema is ready.")


if __name__ == "__main__":
    main()
