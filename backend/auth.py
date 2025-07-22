from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from models import db, User
from marshmallow import Schema, fields, ValidationError
import re

auth_bp = Blueprint('auth', __name__)


class UserRegistrationSchema(Schema):
    username = fields.Str(required=True, validate=lambda x: len(x) >= 3)
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=lambda x: len(x) >= 6)
    role = fields.Str(required=True, validate=lambda x: x in ['therapist', 'patient'])

class UserLoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True)

@auth_bp.route('/register', methods=['POST'])
def register():
    try:
        schema = UserRegistrationSchema()
        data = schema.load(request.json)
    except ValidationError as err:
        return jsonify({'error': 'Validation error', 'messages': err.messages}), 400

    # Check if user already exists
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'error': 'User with this email already exists'}), 400

    if User.query.filter_by(username=data['username']).first():
        return jsonify({'error': 'Username already taken'}), 400

    # Create new user
    user = User(
        username=data['username'],
        email=data['email'],
        role=data['role']
    )
    user.set_password(data['password'])

    db.session.add(user)
    db.session.commit()

    # Create access token
    access_token = create_access_token(identity=str(user.id))

    return jsonify({
        'message': 'User registered successfully',
        'access_token': access_token,
        'user': user.to_dict()
    }), 201


@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        schema = UserLoginSchema()
        data = schema.load(request.json)
    except ValidationError as err:
        return jsonify({'error': 'Validation error', 'messages': err.messages}), 400

    user = User.query.filter_by(email=data['email']).first()

    if user and user.check_password(data['password']):
        access_token = create_access_token(identity=str(user.id))
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': user.to_dict()
        }), 200

    return jsonify({'error': 'Invalid email or password'}), 401


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    return jsonify({'user': user.to_dict()}), 200


@auth_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.json

    if 'username' in data:
        # Check if username is already taken
        existing_user = User.query.filter_by(username=data['username']).first()
        if existing_user and existing_user.id != user.id:
            return jsonify({'error': 'Username already taken'}), 400
        user.username = data['username']

    if 'email' in data:
        # Validate email format
        if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', data['email']):
            return jsonify({'error': 'Invalid email format'}), 400

        # Check if email is already taken
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user and existing_user.id != user.id:
            return jsonify({'error': 'Email already taken'}), 400
        user.email = data['email']

    if 'password' in data:
        if len(data['password']) < 6:
            return jsonify({'error': 'Password must be at least 6 characters long'}), 400
        user.set_password(data['password'])

    db.session.commit()

    return jsonify({
        'message': 'Profile updated successfully',
        'user': user.to_dict()
    }), 200