# flake8: noqa
import os
import uvicorn
from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from dotenv import load_dotenv
import pytesseract
from PIL import Image
import io
import google.generativeai as genai
from pymongo import MongoClient
from pydantic import BaseModel, Field
from fpdf import FPDF
from fastapi.responses import StreamingResponse
from pydantic_core import core_schema
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone # Keep timezone import
from passlib.context import CryptContext
from bson import ObjectId
from typing import List, Optional, Literal # Keep Literal import
import json
import traceback # For better error logging in PDF generation

# --- PRINT DEBUG VERSION ---
# Check if genai was imported correctly before using it
genai_version = "Not Loaded"
try:
    if genai:
        genai_version = genai.__version__
except NameError:
     genai = None # Ensure genai is None if import failed somewhere
print(f"DEBUG: 'google-generativeai' library version: {genai_version}")


# --- LOAD .env AND CONFIGURE ---
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")
MONGO_URI = os.getenv("MONGO_URI")
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"

# --- Password Hashing Context ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- CHECK SECRETS ---
if not API_KEY: print("ERROR: GEMINI_API_KEY not found")
elif genai: # Only configure if the library was loaded
    try:
        genai.configure(api_key=API_KEY)
        print("DEBUG: Gemini API Key loaded and configured successfully.")
    except Exception as genai_config_error:
        print(f"ERROR: Failed to configure Gemini API: {genai_config_error}")
if not MONGO_URI: print("ERROR: MONGO_URI not found")
if not JWT_SECRET_KEY: print("ERROR: JWT_SECRET_KEY not found")

# --- DATABASE CONNECTION ---
client = None # Initialize client to None
db = None
users_collection = None
notebooks_collection = None
try:
    if MONGO_URI: # Only connect if URI is present
        print("DEBUG: Attempting MongoDB connection...")
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000) # Add timeout
        # The ismaster command is cheap and does not require auth.
        client.admin.command('ismaster')
        db = client.smart_notebook_db
        users_collection = db.users
        notebooks_collection = db.notebooks
        print("DEBUG: MongoDB connection successful.")
    else:
        print("ERROR: MONGO_URI not set. Cannot connect to MongoDB.")
except Exception as e:
    print(f"ERROR: Could not connect to MongoDB: {e}")
    client = None # Ensure client is None if connection failed

# --- PYDANTIC MODELS ---

class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls): yield cls.validate
    @classmethod
    def validate(cls, v, *_):
        if isinstance(v, ObjectId): return v
        if isinstance(v, str) and ObjectId.is_valid(v): return ObjectId(v)
        raise ValueError(f"Invalid ObjectId: {v}")
    @classmethod
    def __get_pydantic_json_schema__(cls, core_schema_obj, handler):
        return core_schema.StringSchema()
    @classmethod
    def __get_pydantic_core_schema__(cls, source, handler):
         # Define how Pydantic should validate it internally
        # Ensures that the input is validated by our `validate` method
        return core_schema.no_info_plain_validator_function(cls.validate)

# --- NEW: Model for updating tags ---
class TagsUpdate(BaseModel):
    tags: List[str] # Expect a list of tag strings

class User(BaseModel):
    name: Optional[str] = None # Add name, make optional for login model reuse
    email: str
    password: str

class UserProfile(BaseModel):
    id: PyObjectId = Field(alias="_id") # Use correct alias
    email: str
    name: Optional[str] = None # Name might be missing for old users
    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True

class Token(BaseModel):
    access_token: str
    token_type: str
    email: str

class Note(BaseModel):
    # Use PyObjectId directly as default_factory might cause issues with validation context
    id: PyObjectId = Field(default_factory=ObjectId, alias="_id")
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True

class AccessEntry(BaseModel):
    user_email: str
    permission: Literal['view', 'edit']

# --- UPDATED: Notebook model for Discovery features ---
class Notebook(BaseModel):
    id: PyObjectId = Field(default_factory=ObjectId, alias="_id") # Use PyObjectId here for consistency
    name: str
    owner_email: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    notes: List[Note] = []
    access_list: List[AccessEntry] = []
    is_public: bool = False # <-- NEW: Default to private
    tags: Optional[List[str]] = [] # <-- NEW: Optional tags
    likes: List[str] = [] # <-- NEW: List of emails of users who liked

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True

class NotebookCreate(BaseModel):
    name: str

class NoteCreate(BaseModel):
    content: str

class QuizQuestion(BaseModel):
    question: str
    options: List[str]
    correct_answer: str

class QuizData(BaseModel):
    questions: List[QuizQuestion]

class ShareRequest(BaseModel):
    recipient_email: str
    permission: Literal['view', 'edit']

class UserStats(BaseModel):
    notebooks_created: int
    notes_created: int
    notebooks_shared_by_user: int
    notebooks_shared_with_user: int
    total_likes_received: int
    # Add more stats later if needed
# --- Models for Detailed Profile Response ---

class SharedNotebookInfo(BaseModel): # For notebooks shared BY or WITH user
    id: PyObjectId = Field(alias="_id")
    name: str
    # For shared BY user:
    shared_with: Optional[List[AccessEntry]] = None # List of who it's shared with
    # For shared WITH user:
    owner_email: Optional[str] = None
    permission: Optional[Literal['view', 'edit']] = None

    class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True


class PublicNotebookLikesInfo(BaseModel): # For user's public notebooks
     id: PyObjectId = Field(alias="_id")
     name: str
     like_count: int
     # likes: List[str] # Optionally include who liked it

     class Config:
        json_encoders = {ObjectId: str}
        populate_by_name = True
        arbitrary_types_allowed = True


class ProfileDetails(BaseModel):
    # Basic Info (can reuse UserProfile or define here)
    email: str
    name: Optional[str] = None
    # Stats (reuse UserStats)
    stats: UserStats
    # Detailed Lists
    notebooks_shared_by_user: List[SharedNotebookInfo]
    notebooks_shared_with_user: List[SharedNotebookInfo]
    public_notebooks_likes: List[PublicNotebookLikesInfo]
    # Optional: Add data for graphs later
    # notes_activity_data: Optional[dict] = None # e.g., {"2025-10-20": 5, ...}

# --- JWT HELPER FUNCTIONS ---
def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=1))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_password_hash(password): return pwd_context.hash(password)
def verify_password(plain_password, hashed_password): return pwd_context.verify(plain_password, hashed_password)

# --- PERMISSION HELPER ---
def check_permission(notebook_doc: dict | None, user_email: str, required_permission: Literal['view', 'edit']) -> bool:
    if not notebook_doc:
        print(f"DEBUG: Permission check failed: Notebook document is None for user {user_email}")
        return False
    if notebook_doc.get("owner_email") == user_email:
        print(f"DEBUG: Permission check passed: User {user_email} is owner.")
        return True
    access_list = notebook_doc.get("access_list", [])
    for entry in access_list:
        if entry.get("user_email") == user_email:
            user_perm = entry.get("permission")
            print(f"DEBUG: Permission check: User {user_email} found in access list with permission '{user_perm}'. Required: '{required_permission}'.")
            if user_perm == 'edit': return True # Edit implies view
            if user_perm == 'view' and required_permission == 'view': return True
            # If loop finishes without returning, user is in list but lacks required permission
            print(f"DEBUG: Permission check failed: User {user_email} has '{user_perm}', but requires '{required_permission}'.")
            return False # Found user, but insufficient permission
    # If loop finishes, user is not owner and not in access list
    print(f"DEBUG: Permission check failed: User {user_email} is not owner and not in access list.")
    return False

# --- START FASTAPI APP ---
app = FastAPI()

# --- CORS MIDDLEWARE ---
origins = ["http://localhost:5173", "http://localhost:3000"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"],)

# --- OAUTH2 & USER VERIFICATION ---
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")
async def get_current_user(token: str = Depends(oauth2_scheme)):
    # Add extra debug prints
    print(f"DEBUG: get_current_user called with token: {token[:10]}...") # Print start of token
    credentials_exception = HTTPException(status_code=401, detail="Could not validate credentials", headers={"WWW-Authenticate": "Bearer"},)
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        print(f"DEBUG: Token payload decoded, email: {email}")
        if email is None:
             print("ERROR: Token payload missing 'sub' (email).")
             raise credentials_exception
    except JWTError as e:
        print(f"ERROR: JWTError during token decode: {e}")
        raise credentials_exception
    except Exception as e:
        print(f"ERROR: Unexpected error during token decode: {e}")
        raise credentials_exception

    if users_collection is None:
         print("ERROR: users_collection is None in get_current_user.")
         raise HTTPException(status_code=503, detail="Database not connected")

    user = users_collection.find_one({"email": email})
    if user is None:
        print(f"ERROR: User with email '{email}' not found in database.")
        raise credentials_exception
    print(f"DEBUG: Auth successful for user: {email}")
    # Convert _id for safety, though returning dict might be okay if Pydantic handles it downstream
    user["_id"] = str(user["_id"])
    return user


# --- Dependency check for DB ---
async def get_db_collections():
    """Dependency function to ensure DB is connected and return collections."""
    if not client or users_collection is None or notebooks_collection is None:
        # Log the specific issue
        db_status = "Client not initialized" if not client else "Collections not initialized"
        print(f"ERROR: DB Dependency failed - {db_status}")
        raise HTTPException(status_code=503, detail="Database service unavailable.")
    return users_collection, notebooks_collection

# --- AUTH ENDPOINTS ---
@app.post("/register", response_model=User) # Response model can stay User, but we won't return password
async def register_user(user: User, collections = Depends(get_db_collections)):
    users_coll, _ = collections
    # --- !! VALIDATE NAME FOR REGISTRATION !! ---
    if not user.name or len(user.name.strip()) == 0:
        raise HTTPException(status_code=422, detail="Name is required for registration.")

    print(f"DEBUG: Register attempt for: {user.email}, Name: {user.name}")
    existing_user = users_coll.find_one({"email": user.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    try:
        hashed_password = get_password_hash(user.password)
    except Exception as hash_error:
        print(f"ERROR: Password hashing failed: {hash_error}")
        raise HTTPException(status_code=500, detail="Error processing registration.")

    # --- !! SAVE NAME TO DB !! ---
    user_dict = {
        "email": user.email,
        "password": hashed_password,
        "name": user.name.strip() # Save the name
    }
    users_coll.insert_one(user_dict)
    print(f"DEBUG: User {user.email} successfully registered.")
    # Return user details without password
    return {"email": user.email, "name": user.name.strip(), "password": "---"}

@app.post("/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), collections = Depends(get_db_collections)):
    users_coll, _ = collections
    email = form_data.username
    password = form_data.password
    print(f"DEBUG: Login attempt for: {email}")
    db_user = users_coll.find_one({"email": email})
    # Add detailed check
    if not db_user:
        print(f"DEBUG: Login failed - user '{email}' not found.")
        raise HTTPException(status_code=401, detail="Incorrect email or password", headers={"WWW-Authenticate": "Bearer"},)
    if not verify_password(password, db_user.get("password", "")):
        print(f"DEBUG: Login failed - password incorrect for user '{email}'.")
        raise HTTPException(status_code=401, detail="Incorrect email or password", headers={"WWW-Authenticate": "Bearer"},)

    access_token = create_access_token(data={"sub": email})
    print(f"DEBUG: Login successful for {email}. Token created.")
    return {"access_token": access_token, "token_type": "bearer", "email": email}

# --- !! NEW ENDPOINT: GET CURRENT USER DETAILS !! ---
@app.get("/users/me", response_model=UserProfile)
async def read_users_me(current_user: dict = Depends(get_current_user)):
    # get_current_user already fetches the user dict from DB
    # We just need to ensure the response matches UserProfile model
    print(f"DEBUG: Fetching profile for user: {current_user.get('email')}")
    # The current_user dict already has _id converted to str by get_current_user
    # Pydantic will validate the structure and handle optional 'name'
    return current_user

# --- !! NEW ENDPOINT: GET USER STATISTICS !! ---
@app.get("/users/me/stats", response_model=UserStats)
async def get_user_stats(
    current_user: dict = Depends(get_current_user),
    collections = Depends(get_db_collections)
):
    users_coll, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: Calculating stats for user: {user_email}")

    try:
        # 1. Notebooks Created (Owned)
        notebooks_created = notebooks_coll.count_documents({"owner_email": user_email})

        # 2. Notes Created (Across Owned Notebooks) - Use Aggregation
        notes_created_pipeline = [
            {"$match": {"owner_email": user_email}},
            {"$project": {"notes_count": {"$size": {"$ifNull": ["$notes", []]}}}}
        ]
        notes_counts = list(notebooks_coll.aggregate(notes_created_pipeline))
        notes_created = sum(item.get("notes_count", 0) for item in notes_counts)

        # 3. Notebooks Shared BY User
        notebooks_shared_by_user = notebooks_coll.count_documents({
            "owner_email": user_email,
            "access_list": {"$exists": True, "$ne": []} # Check if access_list exists and is not empty
        })

        # 4. Notebooks Shared WITH User
        notebooks_shared_with_user = notebooks_coll.count_documents({
            "owner_email": {"$ne": user_email},
            "access_list": {"$elemMatch": {"user_email": user_email}}
        })

        # 5. Total Likes Received (Across Owned Public Notebooks) - Use Aggregation
        likes_received_pipeline = [
            {"$match": {"owner_email": user_email, "is_public": True}},
            {"$project": {"likes_count": {"$size": {"$ifNull": ["$likes", []]}}}}
        ]
        likes_counts = list(notebooks_coll.aggregate(likes_received_pipeline))
        total_likes_received = sum(item.get("likes_count", 0) for item in likes_counts)

        print(f"DEBUG: Stats calculated for {user_email}: Created={notebooks_created}, Notes={notes_created}, SharedBy={notebooks_shared_by_user}, SharedWith={notebooks_shared_with_user}, Likes={total_likes_received}")

        return UserStats(
            notebooks_created=notebooks_created,
            notes_created=notes_created,
            notebooks_shared_by_user=notebooks_shared_by_user,
            notebooks_shared_with_user=notebooks_shared_with_user,
            total_likes_received=total_likes_received,
        )

    except Exception as e:
        print(f"ERROR: Failed to calculate stats for {user_email}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to calculate user statistics.")

# --- NOTEBOOK ENDPOINTS (CORRECT ORDER) ---

@app.post("/notebooks", response_model=Notebook)
async def create_notebook(notebook: NotebookCreate, current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
    _, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: User {user_email} creating notebook '{notebook.name}'")
    new_notebook_data = {
        "name": notebook.name,
        "owner_email": user_email,
        "created_at": datetime.now(timezone.utc),
        "notes": [],
        "access_list": [],
        "is_public": False, # <-- Add default
        "tags": [],        # <-- Add default
        "likes": []        # <-- Add default
    }
    # ... (rest of the function: insert, find, return) ...
    try:
        result = notebooks_coll.insert_one(new_notebook_data)
        created_doc = notebooks_coll.find_one({"_id": result.inserted_id})
        print(f"DEBUG: Notebook created with ID: {result.inserted_id}")
        if created_doc: # Ensure fields for response model
             if "notes" not in created_doc: created_doc["notes"] = []
             if "access_list" not in created_doc: created_doc["access_list"] = []
             if "is_public" not in created_doc: created_doc["is_public"] = False
             if "tags" not in created_doc: created_doc["tags"] = []
             if "likes" not in created_doc: created_doc["likes"] = []
        else:
             raise HTTPException(status_code=404, detail="Failed to retrieve created notebook.")
        return created_doc
    except Exception as e:
        print(f"ERROR: Failed to create notebook: {e}")
        raise HTTPException(status_code=500, detail="Failed to create notebook.")

@app.get("/notebooks", response_model=List[Notebook])
async def get_user_notebooks(current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
    _, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: Fetching notebooks for user: {user_email}")
    try:
        user_notebooks = list(notebooks_coll.find({"owner_email": user_email}))
        for nb in user_notebooks:
            if "notes" not in nb: nb["notes"] = []
            if "access_list" not in nb: nb["access_list"] = []
        print(f"DEBUG: Found {len(user_notebooks)} notebooks for {user_email}.")
        return user_notebooks
    except Exception as e:
        print(f"ERROR: Failed to fetch user notebooks: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notebooks.")

@app.post("/notebooks/{notebook_id}/share", status_code=204)
async def share_notebook(notebook_id: str, share_request: ShareRequest, current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
    users_coll, notebooks_coll = collections
    owner_email = current_user["email"]
    recipient_email = share_request.recipient_email
    permission = share_request.permission
    print(f"DEBUG: Share attempt: {owner_email} -> {recipient_email} for NB {notebook_id} ({permission})")

    if owner_email == recipient_email:
        raise HTTPException(status_code=400, detail="Cannot share with yourself.")

    try: nb_object_id = ObjectId(notebook_id)
    except Exception: raise HTTPException(status_code=400, detail="Invalid notebook ID format.")

    recipient_user = users_coll.find_one({"email": recipient_email})
    if not recipient_user:
        raise HTTPException(status_code=404, detail=f"Recipient user '{recipient_email}' not found.")

    notebook_doc = notebooks_coll.find_one({"_id": nb_object_id, "owner_email": owner_email})
    if not notebook_doc:
        raise HTTPException(status_code=404, detail="Notebook not found or you are not the owner.")

    current_access = notebook_doc.get("access_list", [])
    existing_entry_index = next((i for i, entry in enumerate(current_access) if entry.get("user_email") == recipient_email), -1)

    try:
        if existing_entry_index != -1:
            print(f"DEBUG: Updating permission for {recipient_email}")
            # Ensure we are targeting the correct element in the array update
            update_result = notebooks_coll.update_one(
                 {"_id": nb_object_id, f"access_list.{existing_entry_index}.user_email": recipient_email}, # More specific filter
                 {"$set": {f"access_list.{existing_entry_index}.permission": permission}}
            )
            # Check if filter matched, even if modification didn't happen (permission was same)
            if update_result.matched_count == 0:
                print(f"ERROR: Failed to match existing access entry for update.")
                raise HTTPException(status_code=500, detail="Failed to update sharing permission (match failed).")
        else:
            print(f"DEBUG: Adding {recipient_email} to access list")
            new_access_entry = {"user_email": recipient_email, "permission": permission}
            update_result = notebooks_coll.update_one(
                {"_id": nb_object_id}, {"$push": {"access_list": new_access_entry}}
            )
            if update_result.modified_count != 1:
                print(f"ERROR: Failed to add sharing permission (modified_count={update_result.modified_count}).")
                raise HTTPException(status_code=500, detail="Failed to add sharing permission.")
    except Exception as e:
        print(f"ERROR: Database error during share update: {e}")
        raise HTTPException(status_code=500, detail="Database error during sharing.")

    print(f"DEBUG: Share successful for NB {notebook_id} with {recipient_email}")
    # Return 204 implicitly

# --- Specific /shared path FIRST ---
@app.get("/notebooks/shared", response_model=List[Notebook])
async def get_shared_notebooks(current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
    _, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: Fetching notebooks shared with user: {user_email}")
    try:
        shared_notebooks_cursor = notebooks_coll.find({
            "owner_email": {"$ne": user_email},
            "access_list": {"$elemMatch": {"user_email": user_email}}
        })
        shared_notebooks = list(shared_notebooks_cursor)
        for nb in shared_notebooks:
            if "notes" not in nb: nb["notes"] = []
            if "access_list" not in nb: nb["access_list"] = []
        print(f"DEBUG: Found {len(shared_notebooks)} notebooks shared with {user_email}.")
        return shared_notebooks
    except Exception as e:
        print(f"ERROR: Failed to fetch shared notebooks: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch shared notebooks.")

# --- Variable path SECOND ---
@app.get("/notebooks/{notebook_id}", response_model=Notebook)
async def get_single_notebook(notebook_id: str, current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
    _, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: User {user_email} fetching NB {notebook_id}")
    try: nb_object_id = ObjectId(notebook_id)
    except Exception: raise HTTPException(status_code=400, detail="Invalid notebook ID format.")

    notebook_doc = notebooks_coll.find_one({"_id": nb_object_id})
    # Pass the fetched doc to check_permission
    if not check_permission(notebook_doc, user_email, required_permission='view'):
        # Log before raising
        print(f"ACCESS DENIED: User {user_email} lacks view permission for notebook {notebook_id}")
        raise HTTPException(status_code=403, detail="Access denied to this notebook.")

    # Ensure required fields exist if notebook_doc is not None
    if notebook_doc:
        if "notes" not in notebook_doc: notebook_doc["notes"] = []
        if "access_list" not in notebook_doc: notebook_doc["access_list"] = []
        print(f"DEBUG: Found notebook '{notebook_doc.get('name', 'N/A')}'. Access granted.")
        return notebook_doc
    else:
        # This case should technically be caught by check_permission, but handle defensively
        raise HTTPException(status_code=404, detail="Notebook not found.")


# --- !! CORRECTED add_note_to_notebook !! ---
@app.post("/notebooks/{notebook_id}/notes", response_model=Note)
async def add_note_to_notebook(
    notebook_id: str,
    note: NoteCreate,
    current_user: dict = Depends(get_current_user),
    collections = Depends(get_db_collections)
):
    _, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: User {user_email} attempting to add note to notebook ID: {notebook_id}")

    try:
        nb_object_id = ObjectId(notebook_id)
    except Exception:
        print(f"ERROR: Invalid notebook_id format: {notebook_id}")
        raise HTTPException(status_code=400, detail="Invalid notebook ID format.")

    # Find the notebook by ID only first
    notebook_doc = notebooks_coll.find_one({"_id": nb_object_id})
    if not notebook_doc:
        print(f"ERROR: Notebook {notebook_id} not found when attempting to add note.")
        raise HTTPException(status_code=404, detail="Notebook not found.")

    # --- CORRECT PERMISSION CHECK ---
    # Now check if the current user has 'edit' permission
    if not check_permission(notebook_doc, user_email, required_permission='edit'):
        # Log specific denial reason
        print(f"ACCESS DENIED: User {user_email} lacks EDIT permission for notebook {notebook_id}")
        raise HTTPException(status_code=403, detail="You do not have permission to add notes to this notebook.")

    # --- If permission check passes, proceed ---
    print(f"DEBUG: Edit permission granted for user {user_email} on notebook {notebook_id}.")
    try:
        new_note = Note(content=note.content)
        # model_dump includes alias handling (_id) and ObjectId encoding via Config
        new_note_dict_for_db = new_note.model_dump(by_alias=True)
        # new_note_dict_for_db["_id"] = ObjectId(new_note_dict_for_db["_id"]) # Factory/validator should handle this

        result = notebooks_coll.update_one(
            {"_id": nb_object_id},
            {"$push": {"notes": new_note_dict_for_db}}
        )

        if result.modified_count == 1:
            print(f"DEBUG: Note added successfully to notebook {notebook_id}")
            # Return the note dict; Pydantic handles response model conversion/encoding
            return new_note_dict_for_db
        else:
            print(f"ERROR: Failed to add note to MongoDB (modified_count=0). Result: {result.raw_result}")
            raise HTTPException(status_code=500, detail="Failed to save note to database.")
    except Exception as e:
        print(f"ERROR: Exception during note insertion: {e}")
        raise HTTPException(status_code=500, detail="Internal server error while adding note.")


@app.put("/notebooks/{notebook_id}/notes/{note_id}", response_model=Note)
async def edit_note_in_notebook(notebook_id: str, note_id: str, note_update: NoteCreate, current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
     _, notebooks_coll = collections
     user_email = current_user["email"]
     print(f"DEBUG: User {user_email} editing note {note_id} in NB {notebook_id}")
     try:
         nb_object_id = ObjectId(notebook_id)
         nt_object_id = ObjectId(note_id)
     except Exception: raise HTTPException(status_code=400, detail="Invalid ID format.")

     notebook_doc = notebooks_coll.find_one({"_id": nb_object_id})
     if not check_permission(notebook_doc, user_email, required_permission='edit'):
         raise HTTPException(status_code=403, detail="Permission denied to edit notes.")

     result = notebooks_coll.update_one(
         {"_id": nb_object_id, "notes._id": nt_object_id},
         {"$set": {"notes.$.content": note_update.content}}
         # Add "$currentDate": {"notes.$.last_edited_at": True} if tracking edits
     )

     if result.matched_count == 0:
         # Check if notebook exists but note doesn't
         if notebook_doc:
             print(f"ERROR: Note {note_id} not found within notebook {notebook_id}")
             raise HTTPException(status_code=404, detail="Note not found within the specified notebook.")
         else: # Notebook itself doesn't exist (should be caught by check_permission ideally)
             raise HTTPException(status_code=404, detail="Notebook not found.")

     # Fetch the updated notebook doc again to get the modified note for the response
     updated_notebook = notebooks_coll.find_one({"_id": nb_object_id})
     if not updated_notebook: # Should not happen if previous find worked
          raise HTTPException(status_code=404, detail="Notebook disappeared after update.")

     updated_note_data = next((n for n in updated_notebook.get("notes", []) if n["_id"] == nt_object_id), None)

     if updated_note_data:
        print(f"DEBUG: Note {note_id} updated successfully (modified_count={result.modified_count}).")
        # Pydantic handles ObjectId -> str based on Note model Config for the response
        return updated_note_data
     else:
        # This case means the note existed before the update but is gone now (highly unlikely)
        # Or the update somehow failed silently after matching
        print(f"ERROR: Note {note_id} not found in notebook {notebook_id} *after* successful update match.")
        raise HTTPException(status_code=404, detail="Updated note could not be retrieved.")


@app.delete("/notebooks/{notebook_id}/notes/{note_id}", status_code=204)
async def delete_note_from_notebook(notebook_id: str, note_id: str, current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
     _, notebooks_coll = collections
     user_email = current_user["email"]
     print(f"DEBUG: User {user_email} deleting note {note_id} from NB {notebook_id}")
     try:
         nb_object_id = ObjectId(notebook_id)
         nt_object_id = ObjectId(note_id)
     except Exception: raise HTTPException(status_code=400, detail="Invalid ID format.")

     notebook_doc = notebooks_coll.find_one({"_id": nb_object_id})
     # Check permission before attempting delete
     if not check_permission(notebook_doc, user_email, required_permission='edit'):
         raise HTTPException(status_code=403, detail="Permission denied to delete notes.")

     # Perform the delete ($pull)
     result = notebooks_coll.update_one(
         {"_id": nb_object_id}, # Filter by notebook ID
         {"$pull": {"notes": {"_id": nt_object_id}}} # Condition to remove note by its ID
     )

     if result.modified_count == 1:
         print(f"DEBUG: Note {note_id} deleted successfully.")
         # Return 204 No Content (FastAPI handles this for status_code=204)
     elif result.matched_count == 1: # Notebook found, but note wasn't (already deleted?)
         print(f"WARN: Note {note_id} not found in notebook {notebook_id} during delete attempt (already deleted?).")
         # Still return 204 as the desired state (note gone) is achieved
         pass # Or raise 404 if you prefer strict "note must exist to be deleted"
     else: # Notebook itself wasn't found (should be caught by permission check)
         print(f"ERROR: Notebook {notebook_id} not found during delete attempt.")
         raise HTTPException(status_code=404, detail="Notebook not found.")


@app.get("/notebooks/{notebook_id}/pdf")
async def generate_notebook_pdf(notebook_id: str, current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
    _, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: User {user_email} requesting PDF for NB {notebook_id}")
    try: nb_object_id = ObjectId(notebook_id)
    except Exception: raise HTTPException(status_code=400, detail="Invalid notebook ID.")

    notebook_doc = notebooks_coll.find_one({"_id": nb_object_id})
    if not check_permission(notebook_doc, user_email, required_permission='view'):
         raise HTTPException(status_code=403, detail="Access denied.")

    notes = notebook_doc.get("notes", [])
    notebook_name = notebook_doc.get("name", "Untitled")
    created_date_obj = notebook_doc.get("created_at")
    created_date = created_date_obj.strftime("%B %d, %Y") if created_date_obj else "N/A"
    print(f"DEBUG: Generating PDF for '{notebook_name}' with {len(notes)} notes.")

    try:
        class PDF(FPDF):
            def header(self): pass
            def footer(self):
                self.set_y(-15)
                try: self.add_font("DejaVu", "", "DejaVuSans.ttf", uni=True)
                except RuntimeError: pass
                self.set_font("DejaVu", '', 8)
                self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

        pdf = PDF()
        font_path = os.path.join(os.path.dirname(__file__), "DejaVuSans.ttf") # More robust path
        if not os.path.exists(font_path):
            print(f"ERROR: Font file not found at {font_path}")
            raise HTTPException(status_code=500, detail="PDF generation failed: Font file missing.")
        try:
           pdf.add_font("DejaVu", "", font_path, uni=True)
           print("DEBUG: DejaVu font added.")
        except RuntimeError: print("DEBUG: DejaVu font already added.")

        pdf.set_font("DejaVu", size=12)
        pdf.set_auto_page_break(auto=True, margin=15)
        pdf.set_margins(left=15, top=15, right=15)

        pdf.add_page()
        pdf.set_font("DejaVu", '', 24)
        pdf.cell(0, 20, txt=notebook_name, ln=True, align='C')
        pdf.set_font("DejaVu", '', 14)
        pdf.cell(0, 10, txt=f"Notes for {user_email}", ln=True, align='C')
        pdf.cell(0, 10, txt=f"Notebook Created: {created_date}", ln=True, align='C')
        pdf.ln(20)

        if notes:
            pdf.add_page()
            pdf.set_font("DejaVu", '', 16)
            pdf.cell(0, 10, txt="Saved Notes", ln=True, align='L')
            pdf.ln(5)
            for i, note in enumerate(notes):
                note_content = note.get("content", "")
                note_created_at = note.get("created_at")
                note_date_str = "N/A"
                if note_created_at:
                     # Ensure datetime object before formatting
                     if isinstance(note_created_at, datetime):
                        if note_created_at.tzinfo is None: note_created_at = note_created_at.replace(tzinfo=timezone.utc)
                        note_date_str = note_created_at.astimezone().strftime("%Y-%m-%d %I:%M %p %Z")
                     else:
                        print(f"WARN: Note created_at is not a datetime object: {type(note_created_at)}")

                pdf.set_font("DejaVu", '', 10)
                pdf.set_text_color(100, 100, 100)
                pdf.cell(0, 8, txt=f"Saved: {note_date_str}", ln=True, align='L')
                pdf.set_text_color(0, 0, 0)
                pdf.set_font("DejaVu", '', 11)
                pdf.multi_cell(0, 5, txt=note_content)
                pdf.ln(8)
                if i < len(notes) - 1:
                    pdf.line(pdf.get_x(), pdf.get_y(), pdf.get_x() + pdf.w - pdf.l_margin - pdf.r_margin, pdf.get_y())
                    pdf.ln(5)

        pdf_output = io.BytesIO()
        pdf.output(pdf_output)
        pdf_output.seek(0)
        safe_filename = "".join(c for c in notebook_name if c.isalnum() or c in (' ', '_')).rstrip()
        filename = f"{safe_filename}_Notes.pdf"
        print(f"DEBUG: Enhanced PDF generated: {filename}")
        return StreamingResponse(
            pdf_output, media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
        )
    except Exception as pdf_error:
        print(f"ERROR: PDF generation failed: {pdf_error}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"PDF Generation Error: {str(pdf_error)}")


@app.post("/notebooks/{notebook_id}/quiz", response_model=QuizData)
async def generate_notebook_quiz(notebook_id: str, current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
     _, notebooks_coll = collections
     user_email = current_user["email"]
     print(f"DEBUG: User {user_email} requesting quiz for NB {notebook_id}")
     try: nb_object_id = ObjectId(notebook_id)
     except Exception: raise HTTPException(status_code=400, detail="Invalid notebook ID.")

     notebook_doc = notebooks_coll.find_one({"_id": nb_object_id})
     if not check_permission(notebook_doc, user_email, required_permission='view'):
         raise HTTPException(status_code=403, detail="Access denied.")

     notes = notebook_doc.get("notes", [])
     if not notes: raise HTTPException(status_code=400, detail="No notes to generate quiz from.")

     full_notes_text = "\n\n---\n\n".join([note.get("content", "") for note in notes])
     if len(full_notes_text) < 50: raise HTTPException(status_code=400, detail="Not enough content for quiz.")
     print(f"DEBUG: Quiz text length: {len(full_notes_text)}")

     if not genai: # Check if Gemini library loaded
         raise HTTPException(status_code=503, detail="AI service not configured.")

     try:
         model = genai.GenerativeModel('models/gemini-flash-latest') # Ensure this model name is correct for your access
         prompt = f"""
         Based on the following study notes, generate a multiple-choice quiz with 5 questions.
         For each question, provide:
         1. "question" (string).
         2. "options" (list of 4 distinct strings).
         3. "correct_answer" (string - the exact correct option text).
         Return strictly as a JSON object: {{"questions": [...]}}. No extra text or markdown.

         Study Notes:
         ---
         {full_notes_text}
         ---
         """
         print("DEBUG: Sending request to Gemini for quiz...")
         generation_config = genai.types.GenerationConfig(response_mime_type="application/json")
         response = await model.generate_content_async(prompt, generation_config=generation_config)

         try:
             # Add more robust cleaning for potential markdown/text around JSON
             raw_text = response.text.strip()
             json_start = raw_text.find('{')
             json_end = raw_text.rfind('}') + 1
             if json_start != -1 and json_end != -1:
                 json_text = raw_text[json_start:json_end]
             else: # Fallback if no {} found
                 json_text = raw_text

             quiz_data_dict = json.loads(json_text)
             # Basic validation before Pydantic
             if "questions" not in quiz_data_dict or not isinstance(quiz_data_dict["questions"], list):
                 raise ValueError("AI response missing 'questions' list.")

             quiz_data = QuizData(**quiz_data_dict) # Validate structure
             if not quiz_data.questions: # Check if list is empty after validation
                 raise ValueError("AI returned an empty 'questions' list.")

             print(f"DEBUG: Quiz generated with {len(quiz_data.questions)} questions.")
             return quiz_data
         except (json.JSONDecodeError, ValueError, Exception) as parse_error: # Catch JSON errors, ValueErrors, Pydantic validation errors
             print(f"ERROR: Parsing Gemini quiz response failed: {parse_error}\nRaw Text:\n{response.text}")
             raise HTTPException(status_code=500, detail="AI response format error.")

     except Exception as e:
         print(f"ERROR: Gemini quiz generation failed: {e}")
         # Check for specific Gemini API errors if possible
         # Example: if "API key not valid" in str(e): raise HTTPException(...)
         raise HTTPException(status_code=500, detail=f"AI quiz generation failed: {str(e)}")


# --- Note Date Endpoints ---
@app.get("/notes/dates", response_model=List[str])
async def get_note_dates(current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
     _, notebooks_coll = collections
     user_email = current_user["email"]
     print(f"DEBUG: Fetching note dates for user: {user_email}")
     try:
         pipeline = [
             {"$match": {"owner_email": user_email}},
             {"$unwind": "$notes"},
             {"$project": { "_id": 0, "note_date": { "$dateToString": { "format": "%Y-%m-%d", "date": "$notes.created_at", "timezone": "UTC" }}}},
             {"$group": { "_id": "$note_date" }},
             {"$project": { "_id": 0, "date": "$_id" }},
             {"$sort": {"date": 1}}
         ]
         results = list(notebooks_coll.aggregate(pipeline))
         unique_dates = [result["date"] for result in results if "date" in result]
         print(f"DEBUG: Found {len(unique_dates)} unique dates.")
         return unique_dates
     except Exception as e:
         print(f"ERROR: Failed to fetch note dates: {e}")
         raise HTTPException(status_code=500, detail="Failed to fetch note dates.")

@app.get("/notes/by-date/{date_str}", response_model=List[Note])
async def get_notes_by_date(date_str: str, current_user: dict = Depends(get_current_user), collections = Depends(get_db_collections)):
    _, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: User {user_email} fetching notes for date: {date_str}")
    try:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        start_of_day = target_date
        end_of_day = start_of_day + timedelta(days=1)
        print(f"DEBUG: Date range UTC: {start_of_day} to {end_of_day}")
        pipeline = [
            # Match user's OWN notebooks first
            {"$match": {"owner_email": user_email}},
            {"$unwind": "$notes"},
            {"$match": { "notes.created_at": { "$gte": start_of_day, "$lt": end_of_day }}},
            {"$replaceRoot": {"newRoot": "$notes"}},
            {"$sort": {"created_at": 1}}
        ]
        notes_for_date = list(notebooks_coll.aggregate(pipeline))
        print(f"DEBUG: Found {len(notes_for_date)} notes for date {date_str}.")
        return notes_for_date
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    except Exception as e:
        print(f"ERROR: Failed to fetch notes by date: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch notes.")

# --- CORE APP ENDPOINTS ---
@app.get("/")
def read_root():
    return {"message": "Hello! The NoteVision backend is running."}

@app.post("/upload-image/")
async def ocr_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    print(f"DEBUG: Image upload received from user: {current_user['email']}")
    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        text = pytesseract.image_to_string(image)
        return {"filename": file.filename, "extracted_text": text}
    except Exception as e:
        print(f"ERROR: OCR processing failed: {e}")
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

@app.post("/summarize-text/")
async def summarize_text(data: dict = Body(...), current_user: dict = Depends(get_current_user)):
     raw_text = data.get("text")
     if not raw_text: raise HTTPException(status_code=400, detail="No text provided.")
     print(f"DEBUG: Summarization received from user: {current_user['email']}")

     if not genai:
          raise HTTPException(status_code=503, detail="AI service not configured.")

     try:
         model = genai.GenerativeModel('models/gemini-flash-latest') # Ensure model exists
         # Using the enhanced prompt from previous step
         prompt = f"""
         You are an expert academic summarizer who helps students convert messy handwritten or OCR text
         (from blackboards, notes, or books) into clean, structured, and easy-to-understand study notes.

         ### TASK INSTRUCTIONS:
         1. Analyze the given raw text carefully — it may have OCR errors, jumbled formatting, or incomplete words.
         2. Identify the *main topic or title* based on the first few words or context. If unclear, use "General Notes".
            - Example: If the text mentions "laws of motion" or "Newton", title should be **"Title: Newton’s Laws of Motion"**.
         3. Correct any obvious OCR or spelling errors.
         4. Remove irrelevant or nonsensical fragments.
         5. Summarize the cleaned content into **clear, short, bullet-point notes**.
         6. Include **simple, real-world examples** after the notes if applicable and relevant to the topic.
         7. Keep the tone simple and student-friendly — like notes written for revision.
         8. If the text is too short or unclear, just clean and reformat it neatly, attempting a title.

         ### OUTPUT FORMAT (Use Markdown):
         **Title:** <Detected or Inferred Topic>

         **Summary:**
         * Bullet point 1 explaining a key concept.
         * Bullet point 2 explaining another key concept.
         * ...

         **Examples:** (Only include if relevant examples can be derived)
         * Example 1 (e.g., A car stopping suddenly demonstrates inertia).
         * Example 2.

         ### RAW TEXT:
         ---
         {raw_text}
         ---
         """
         response = await model.generate_content_async(prompt) # No specific JSON config needed here
         summary = response.text
         print("DEBUG: Summary generated by AI.")
         return {"summary": summary}

     except Exception as e:
         print(f"ERROR: Gemini summarization failed: {e}")
         raise HTTPException(status_code=500, detail=f"AI summarization failed: {str(e)}")

# --- !! NEW ENDPOINT: TOGGLE NOTEBOOK VISIBILITY !! ---
@app.patch("/notebooks/{notebook_id}/visibility", response_model=Notebook)
async def toggle_notebook_visibility(
    notebook_id: str,
    public_status: bool = Body(..., embed=True, alias="is_public"), # Expect {"is_public": true/false}
    current_user: dict = Depends(get_current_user),
    collections = Depends(get_db_collections)
):
    _, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: User {user_email} setting visibility for NB {notebook_id} to {public_status}")

    try: nb_object_id = ObjectId(notebook_id)
    except Exception: raise HTTPException(status_code=400, detail="Invalid notebook ID.")

    # Find notebook AND verify ownership in one query
    update_result = notebooks_coll.update_one(
        {"_id": nb_object_id, "owner_email": user_email},
        {"$set": {"is_public": public_status}}
    )

    if update_result.matched_count == 0:
        # Check if notebook exists but user is not owner
        exists = notebooks_coll.count_documents({"_id": nb_object_id}) > 0
        if exists:
            print(f"ACCESS DENIED: User {user_email} is not owner of NB {notebook_id}")
            raise HTTPException(status_code=403, detail="Only the owner can change visibility.")
        else:
            raise HTTPException(status_code=404, detail="Notebook not found.")

    print(f"DEBUG: Visibility for NB {notebook_id} set to {public_status}")
    # Fetch and return the updated notebook
    updated_doc = notebooks_coll.find_one({"_id": nb_object_id})
    if updated_doc: # Ensure fields for response
         if "notes" not in updated_doc: updated_doc["notes"] = []
         if "access_list" not in updated_doc: updated_doc["access_list"] = []
         if "tags" not in updated_doc: updated_doc["tags"] = []
         if "likes" not in updated_doc: updated_doc["likes"] = []
    return updated_doc if updated_doc else {} # Should always find it


# --- !! NEW ENDPOINT: LIKE/UNLIKE A NOTEBOOK !! ---
@app.post("/notebooks/{notebook_id}/like", response_model=Notebook)
async def like_unlike_notebook(
    notebook_id: str,
    current_user: dict = Depends(get_current_user),
    collections = Depends(get_db_collections)
):
    _, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: User {user_email} attempting to like/unlike NB {notebook_id}")

    try: nb_object_id = ObjectId(notebook_id)
    except Exception: raise HTTPException(status_code=400, detail="Invalid notebook ID.")

    # Find the notebook and ensure it's public
    notebook_doc = notebooks_coll.find_one({"_id": nb_object_id, "is_public": True})
    if not notebook_doc:
        raise HTTPException(status_code=404, detail="Public notebook not found.")

    # Check if user has already liked
    likes_list = notebook_doc.get("likes", [])
    if user_email in likes_list:
        # --- Unlike ---
        print(f"DEBUG: User {user_email} unliking NB {notebook_id}")
        action = "$pull"
    else:
        # --- Like ---
        print(f"DEBUG: User {user_email} liking NB {notebook_id}")
        action = "$addToSet" # addToSet prevents duplicates

    update_result = notebooks_coll.update_one(
        {"_id": nb_object_id},
        {action: {"likes": user_email}}
    )

    if update_result.modified_count == 0 and action == "$pull" and user_email not in likes_list:
         # Handle edge case where user tries to unlike but wasn't in list
          print(f"WARN: User {user_email} tried to unlike NB {notebook_id}, but was not in likes list.")
          # Still return the current doc as state is correct
    elif update_result.modified_count == 0 and action == "$addToSet" and user_email in likes_list:
          print(f"WARN: User {user_email} tried to like NB {notebook_id}, but was already in likes list.")
          # Still return the current doc
    elif update_result.modified_count != 1 and update_result.matched_count == 1:
         print(f"WARN: Like/Unlike operation for {user_email} on NB {notebook_id} did not modify the document (matched_count=1, modified_count=0).")
         # This might happen if the state didn't actually change, return current doc
    elif update_result.matched_count == 0:
         print(f"ERROR: Could not find NB {notebook_id} during like/unlike operation.")
         raise HTTPException(status_code=404, detail="Notebook not found during update.")


    # Fetch and return the updated notebook with new like status/count
    updated_doc = notebooks_coll.find_one({"_id": nb_object_id})
    if updated_doc: # Ensure fields for response
         if "notes" not in updated_doc: updated_doc["notes"] = []
         if "access_list" not in updated_doc: updated_doc["access_list"] = []
         if "tags" not in updated_doc: updated_doc["tags"] = []
         if "likes" not in updated_doc: updated_doc["likes"] = [] # Should exist after update
    return updated_doc if updated_doc else {}


# --- !! NEW ENDPOINT: SEARCH PUBLIC NOTEBOOKS !! ---
# NOTE: For advanced search (content), MongoDB text indexes are better ($text operator).
# This uses simpler regex matching on name and tags for now.
# --- !! CORRECTED ENDPOINT: SEARCH PUBLIC NOTEBOOKS !! ---
@app.get("/notebooks/public/search", response_model=List[Notebook])
async def search_public_notebooks(
    query: Optional[str] = None, # Search query parameter (e.g., ?query=physics)
    current_user: dict = Depends(get_current_user), # Require login to search
    collections = Depends(get_db_collections)
):
    _, notebooks_coll = collections
    user_email = current_user["email"] # Get email for context, although not used in filtering yet
    print(f"DEBUG: User {user_email} searching public notebooks. Query: '{query}'")

    # Base filter: only public notebooks
    filter_query = {"is_public": True}

    if query:
        # Add regex search for name and tags (case-insensitive)
        try:
            # Basic sanitization: escape regex special characters potentially?
            # For now, assume simple query strings
            search_regex = {"$regex": query.strip(), "$options": "i"}
            filter_query["$or"] = [
                {"name": search_regex},
                {"tags": search_regex} # Searches if query is substring within the tags array elements
            ]
        except Exception as regex_err:
             print(f"WARN: Invalid regex pattern from query '{query}'. Error: {regex_err}")
             # Fallback: maybe just search name or ignore query if invalid
             # For now, let's proceed but it might error in MongoDB if regex is bad
             pass


    try:
        # --- Aggregation Pipeline for proper sorting and handling missing fields ---
        pipeline = [
             # 1. Match public notebooks + optional search query
             {"$match": filter_query},
             # 2. Add 'like_count' field, handling missing 'likes' array
             {"$addFields": {
                 # Use $ifNull: if 'likes' field exists use its size, otherwise use 0
                 "like_count": {"$size": {"$ifNull": ["$likes", []]}}
             }},
             # 3. Sort by like_count descending, then maybe by name ascending
             {"$sort": {"like_count": -1, "name": 1}},
             # 4. Project fields: Exclude 'notes' for performance. Include necessary fields for Notebook model.
             {"$project": {
                 "_id": 1,
                 "name": 1,
                 "owner_email": 1,
                 "created_at": 1,
                 # Explicitly include other fields needed by the Pydantic model, handle missing ones
                 "access_list": {"$ifNull": ["$access_list", []]},
                 "is_public": 1, # Should be true due to $match
                 "tags": {"$ifNull": ["$tags", []]},
                 "likes": {"$ifNull": ["$likes", []]},
                 # We don't project 'notes'
                 # We don't strictly need like_count projected unless debugging
             }},
             # 5. Limit results (optional but recommended for performance)
             {"$limit": 50}
        ]

        results = list(notebooks_coll.aggregate(pipeline))

        # --- Post-aggregation check (Optional, Pydantic should handle validation) ---
        # Pydantic will validate each item against the Notebook model.
        # If a required field (like 'name' or 'owner_email') was missing after projection,
        # Pydantic would raise an error during response generation.
        # The $ifNull in projection helps ensure optional list fields exist.

        print(f"DEBUG: Search found {len(results)} public notebooks matching query '{query}'.")
        # FastAPI automatically validates the list against List[Notebook] response_model
        return results

    except Exception as e:
         print(f"ERROR: Failed during public notebook search aggregation: {e}")
         traceback.print_exc() # Print full traceback for aggregation errors
         raise HTTPException(status_code=500, detail="Failed to search notebooks.")

# --- !! NEW ENDPOINT: DELETE A NOTEBOOK !! ---
@app.delete("/notebooks/{notebook_id}", status_code=204) # 204 No Content
async def delete_notebook(
    notebook_id: str,
    current_user: dict = Depends(get_current_user),
    collections = Depends(get_db_collections)
):
    users_coll, notebooks_coll = collections
    user_email = current_user["email"]
    print(f"DEBUG: User {user_email} attempting to delete notebook ID: {notebook_id}")

    try:
        nb_object_id = ObjectId(notebook_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notebook ID format.")

    # --- Use delete_one and filter by BOTH _id and owner_email ---
    # This ensures only the owner can delete their own notebook
    delete_result = notebooks_coll.delete_one(
        {"_id": nb_object_id, "owner_email": user_email}
    )

    if delete_result.deleted_count == 1:
        print(f"DEBUG: Notebook {notebook_id} deleted successfully by owner {user_email}.")
        # Return No Content (implicitly by FastAPI for 204)
    else:
        # Check if the notebook exists at all to give a better error
        notebook_exists = notebooks_coll.count_documents({"_id": nb_object_id}) > 0
        if notebook_exists:
            # Notebook exists, but the user is not the owner
            print(f"ACCESS DENIED: User {user_email} attempted to delete notebook {notebook_id} owned by someone else.")
            raise HTTPException(status_code=403, detail="Permission denied: You can only delete your own notebooks.")
        else:
            # Notebook doesn't exist
            print(f"ERROR: Notebook {notebook_id} not found for deletion.")
            raise HTTPException(status_code=404, detail="Notebook not found.")

# --- !! NEW ENDPOINT: UPDATE NOTEBOOK TAGS !! ---
@app.patch("/notebooks/{notebook_id}/tags", response_model=Notebook)
async def update_notebook_tags(
    notebook_id: str,
    tags_update: TagsUpdate,
    current_user: dict = Depends(get_current_user),
    collections = Depends(get_db_collections)
):
    _, notebooks_coll = collections
    user_email = current_user["email"]
    new_tags = tags_update.tags
    # Basic validation/cleaning: remove empty strings, duplicates, trim whitespace
    cleaned_tags = sorted(list(set(tag.strip() for tag in new_tags if tag.strip())))

    print(f"DEBUG: User {user_email} updating tags for NB {notebook_id} to {cleaned_tags}")

    try: nb_object_id = ObjectId(notebook_id)
    except Exception: raise HTTPException(status_code=400, detail="Invalid notebook ID.")

    # Find notebook AND verify ownership
    update_result = notebooks_coll.update_one(
        {"_id": nb_object_id, "owner_email": user_email},
        {"$set": {"tags": cleaned_tags}} # Set the cleaned tags array
    )

    if update_result.matched_count == 0:
        exists = notebooks_coll.count_documents({"_id": nb_object_id}) > 0
        if exists: raise HTTPException(status_code=403, detail="Only the owner can update tags.")
        else: raise HTTPException(status_code=404, detail="Notebook not found.")

    print(f"DEBUG: Tags updated successfully for NB {notebook_id}")
    # Fetch and return the updated notebook
    updated_doc = notebooks_coll.find_one({"_id": nb_object_id})
    if updated_doc: # Ensure fields
        # ... (add default fields like notes, access_list, likes etc. if missing) ...
        if "notes" not in updated_doc: updated_doc["notes"] = []
        if "access_list" not in updated_doc: updated_doc["access_list"] = []
        if "is_public" not in updated_doc: updated_doc["is_public"] = False
        if "tags" not in updated_doc: updated_doc["tags"] = [] # Should be set now
        if "likes" not in updated_doc: updated_doc["likes"] = []
    return updated_doc if updated_doc else {}

# --- !! NEW COMPREHENSIVE PROFILE ENDPOINT !! ---
# (Remove or comment out the old GET /users/me/stats endpoint)
@app.get("/users/me/profile-details", response_model=ProfileDetails)
async def get_profile_details(
    current_user: dict = Depends(get_current_user),
    collections = Depends(get_db_collections)
):
    users_coll, notebooks_coll = collections
    user_email = current_user["email"]
    user_name = current_user.get("name") # Name fetched by get_current_user
    print(f"DEBUG: Fetching full profile details for user: {user_email}")

    try:
        # --- 1. Calculate Basic Stats (reuse logic) ---
        notebooks_created = notebooks_coll.count_documents({"owner_email": user_email})
        # Notes created aggregation
        notes_pipeline = [{"$match": {"owner_email": user_email}}, {"$project": {"notes_count": {"$size": {"$ifNull": ["$notes", []]}}}}]
        notes_counts = list(notebooks_coll.aggregate(notes_pipeline))
        notes_created = sum(item.get("notes_count", 0) for item in notes_counts)
        # Shared By aggregation
        notebooks_shared_by_user_count = notebooks_coll.count_documents({"owner_email": user_email, "access_list": {"$exists": True, "$ne": []}})
        # Shared With aggregation
        notebooks_shared_with_user_count = notebooks_coll.count_documents({"owner_email": {"$ne": user_email}, "access_list": {"$elemMatch": {"user_email": user_email}}})
        # Likes aggregation
        likes_pipeline = [{"$match": {"owner_email": user_email, "is_public": True}}, {"$project": {"likes_count": {"$size": {"$ifNull": ["$likes", []]}}}}]
        likes_counts = list(notebooks_coll.aggregate(likes_pipeline))
        total_likes_received = sum(item.get("likes_count", 0) for item in likes_counts)

        user_stats = UserStats(
            notebooks_created=notebooks_created, notes_created=notes_created,
            notebooks_shared_by_user=notebooks_shared_by_user_count,
            notebooks_shared_with_user=notebooks_shared_with_user_count,
            total_likes_received=total_likes_received
        )
        print("DEBUG: Basic stats calculated.")

        # --- 2. Get Notebooks Shared BY User ---
        shared_by_user_docs = list(notebooks_coll.find(
            {"owner_email": user_email, "access_list": {"$exists": True, "$ne": []}},
            {"_id": 1, "name": 1, "access_list": 1} # Project only needed fields
        ))
        notebooks_shared_by_user_list = [
            SharedNotebookInfo(id=nb["_id"], name=nb["name"], shared_with=nb.get("access_list", []))
            for nb in shared_by_user_docs
        ]
        print(f"DEBUG: Found {len(notebooks_shared_by_user_list)} notebooks shared by user.")

        # --- 3. Get Notebooks Shared WITH User ---
        shared_with_user_docs = list(notebooks_coll.find(
            {"owner_email": {"$ne": user_email}, "access_list": {"$elemMatch": {"user_email": user_email}}},
            {"_id": 1, "name": 1, "owner_email": 1, "access_list": 1} # Project needed fields
        ))
        notebooks_shared_with_user_list = []
        for nb in shared_with_user_docs:
            my_permission = "view" # Default
            for entry in nb.get("access_list", []):
                if entry.get("user_email") == user_email:
                    my_permission = entry.get("permission", "view")
                    break
            notebooks_shared_with_user_list.append(
                 SharedNotebookInfo(id=nb["_id"], name=nb["name"], owner_email=nb["owner_email"], permission=my_permission)
            )
        print(f"DEBUG: Found {len(notebooks_shared_with_user_list)} notebooks shared with user.")


        # --- 4. Get User's Public Notebooks with Likes (Sorted) ---
        public_likes_pipeline = [
            {"$match": {"owner_email": user_email, "is_public": True}},
            {"$addFields": {"like_count": {"$size": {"$ifNull": ["$likes", []]}}}},
            {"$sort": {"like_count": -1, "name": 1}},
            {"$project": {"_id": 1, "name": 1, "like_count": 1}} # Project needed fields
        ]
        public_notebooks_likes_docs = list(notebooks_coll.aggregate(public_likes_pipeline))
        # Map directly using field names from aggregation
        public_notebooks_likes_list = [
             PublicNotebookLikesInfo(**nb_data) for nb_data in public_notebooks_likes_docs
         ]
        print(f"DEBUG: Found {len(public_notebooks_likes_list)} public notebooks with likes.")

        # --- 5. Assemble Final Response ---
        profile_data = ProfileDetails(
            email=user_email,
            name=user_name,
            stats=user_stats,
            notebooks_shared_by_user=notebooks_shared_by_user_list,
            notebooks_shared_with_user=notebooks_shared_with_user_list,
            public_notebooks_likes=public_notebooks_likes_list
        )

        return profile_data

    except Exception as e:
        print(f"ERROR: Failed to fetch profile details for {user_email}: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to load profile details.")

# ...(rest of main.py)...
# --- SERVER RUN COMMAND ---
if __name__ == "__main__":
    print("DEBUG: Starting Uvicorn server...")
    # Ensure MongoDB connection is attempted before starting server if critical
    if client is None and MONGO_URI:
         print("CRITICAL ERROR: Failed to connect to MongoDB. Server cannot start reliably.")
         # exit(1) # Or handle differently depending on requirements
    else:
        uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)