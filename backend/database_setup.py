"""
Database setup script for Therapy Emotion Detection System
"""
import pymysql
from config import Config
import urllib.parse


def create_database():
    """
    Create the database if it doesn't exist
    """
    try:
        # Parse the database URL
        db_url = Config.SQLALCHEMY_DATABASE_URI
        if db_url.startswith('mysql+pymysql://'):
            # Extract connection details
            url_parts = urllib.parse.urlparse(db_url)

            host = url_parts.hostname
            port = url_parts.port or 3306
            username = url_parts.username
            password = url_parts.password
            database_name = url_parts.path.lstrip('/')

            # Connect to MySQL server (without specifying database)
            connection = pymysql.connect(
                host=host,
                port=port,
                user=username,
                password=password,
                charset='utf8mb4'
            )

            with connection.cursor() as cursor:
                # Create database if it doesn't exist
                cursor.execute(
                    f"CREATE DATABASE IF NOT EXISTS `{database_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
                print(f"✅ Database '{database_name}' created or already exists")

            connection.commit()
            connection.close()

            return True

    except Exception as e:
        print(f"❌ Error creating database: {e}")
        print("Please ensure MySQL is running and credentials are correct")
        return False


def get_sample_data():
    """
    Generate sample data for testing
    """
    return {
        'therapists': [
            {
                'username': 'dr_smith',
                'email': 'dr.smith@therapy.com',
                'password': 'therapist123',
                'role': 'therapist'
            },
            {
                'username': 'dr_johnson',
                'email': 'dr.johnson@therapy.com',
                'password': 'therapist123',
                'role': 'therapist'
            }
        ],
        'patients': [
            {
                'username': 'patient_john',
                'email': 'john@email.com',
                'password': 'patient123',
                'role': 'patient'
            },
            {
                'username': 'patient_mary',
                'email': 'mary@email.com',
                'password': 'patient123',
                'role': 'patient'
            }
        ]
    }


if __name__ == '__main__':
    print("🗄️ Setting up database for Therapy Emotion Detection System...")

    if create_database():
        print("✅ Database setup completed successfully")
        print("\n📝 Sample accounts you can create:")

        sample_data = get_sample_data()

        print("\n👩‍⚕️ Therapists:")
        for therapist in sample_data['therapists']:
            print(f"   Email: {therapist['email']}")
            print(f"   Password: {therapist['password']}")
            print()

        print("🤒 Patients:")
        for patient in sample_data['patients']:
            print(f"   Email: {patient['email']}")
            print(f"   Password: {patient['password']}")
            print()

        print("🚀 Next steps:")
        print("1. Run: pip install -r requirements.txt")
        print("2. Create a .env file based on .env.example")
        print("3. Add your model files:")
        print("   - models/model_weights.h5")
        print("   - models/haarcascade_frontalface_default.xml")
        print("4. Run: python app.py")
    else:
        print("❌ Database setup failed")