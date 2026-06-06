import sqlite3
import os
from datetime import datetime, timedelta

DATABASE = os.path.join(os.path.dirname(__file__), 'inspection.db')

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        model TEXT,
        brand TEXT,
        asset_no TEXT UNIQUE,
        category TEXT NOT NULL,
        location TEXT,
        purchase_date TEXT,
        warranty_date TEXT,
        status TEXT DEFAULT '正常',
        photo TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS inspection_plans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        inspection_type TEXT NOT NULL,
        custom_days INTEGER,
        items TEXT NOT NULL,
        last_inspection_date TEXT,
        next_inspection_date TEXT,
        responsible_person TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices (id)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS inspection_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        plan_id INTEGER,
        inspection_date TEXT NOT NULL,
        result TEXT NOT NULL,
        items_detail TEXT,
        anomaly_description TEXT,
        inspector TEXT,
        photos TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices (id),
        FOREIGN KEY (plan_id) REFERENCES inspection_plans (id)
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS repair_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        report_date TEXT NOT NULL,
        fault_description TEXT NOT NULL,
        repair_date TEXT,
        repair_result TEXT,
        repair_cost REAL DEFAULT 0,
        status TEXT DEFAULT '待处理',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices (id)
    )
    ''')
    
    conn.commit()
    conn.close()

def calculate_next_date(last_date, inspection_type, custom_days=None):
    if not last_date:
        return datetime.now().strftime('%Y-%m-%d')
    
    last = datetime.strptime(last_date, '%Y-%m-%d')
    
    if inspection_type == '每日':
        next_date = last + timedelta(days=1)
    elif inspection_type == '每周':
        next_date = last + timedelta(weeks=1)
    elif inspection_type == '每月':
        if last.month == 12:
            next_date = last.replace(year=last.year + 1, month=1)
        else:
            next_date = last.replace(month=last.month + 1)
    elif inspection_type == '每季':
        month = last.month + 3
        year = last.year
        if month > 12:
            month -= 12
            year += 1
        next_date = last.replace(year=year, month=month)
    elif inspection_type == '自定义' and custom_days:
        next_date = last + timedelta(days=custom_days)
    else:
        next_date = last + timedelta(days=7)
    
    return next_date.strftime('%Y-%m-%d')

if __name__ == '__main__':
    init_db()
    print('数据库初始化完成')
