import tensorflow as tf
from tensorflow import keras
from keras import layers, models
import matplotlib.pyplot as plt
import os
import subprocess
import shutil
import tensorflowjs as tfjs
import re

# Configuration
DATA_DIR = "./output"  # Use the output from generate_variants.py
IMAGE_SIZE = (64, 64)
BATCH_SIZE = 32
EPOCHS = 48
SEED = 42

# --- Custom dataset loader for new folder structure ---
def get_image_paths_and_labels(data_dir):
    image_paths = []
    labels = []
    
    # Get all unique folder names and create a mapping
    folder_names = []
    for folder in os.listdir(data_dir):
        folder_path = os.path.join(data_dir, folder)
        if os.path.isdir(folder_path):
            folder_names.append(folder)
    
    # Sort folder names for consistent ordering
    folder_names.sort()
    
    # Create mapping from folder name to class ID
    class_mapping = {folder: i for i, folder in enumerate(folder_names)}
    
    print(f"Found {len(folder_names)} classes:")
    for folder, class_id in class_mapping.items():
        print(f"  {folder} → Class {class_id}")
    
    # Now scan folders and assign integer labels
    for folder in os.listdir(data_dir):
        folder_path = os.path.join(data_dir, folder)
        if not os.path.isdir(folder_path):
            continue
        
        # Get the integer class ID for this folder
        class_id = class_mapping[folder]
        
        # Add all images in this folder with the same class_id
        for fname in os.listdir(folder_path):
            if fname.lower().endswith((".png", ".jpg", ".jpeg")):
                image_paths.append(os.path.join(folder_path, fname))
                labels.append(class_id)  # ← Now stores integers!
    
    print(f"Total images: {len(image_paths)}")
    print(f"Unique labels: {len(set(labels))}")
    print(f"Label range: {min(labels)} to {max(labels)}")
    
    return image_paths, labels

image_paths, labels = get_image_paths_and_labels(DATA_DIR)

# --- TensorFlow dataset creation ---
def decode_img(img_path):
    img = tf.io.read_file(img_path)
    img = tf.io.decode_png(img, channels=1)
    img = tf.image.resize(img, IMAGE_SIZE)
    img = tf.cast(img, tf.float32) / 255.0
    return img

def process_path(file_path, label):
    img = decode_img(file_path)
    return img, label

dataset = tf.data.Dataset.from_tensor_slices((image_paths, labels))
dataset = dataset.shuffle(buffer_size=len(image_paths), seed=SEED, reshuffle_each_iteration=True)
dataset = dataset.map(process_path, num_parallel_calls=tf.data.AUTOTUNE)

# Split into train/val
val_size = int(0.2 * len(image_paths))
train_ds = dataset.skip(val_size).batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)
val_ds = dataset.take(val_size).batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)

# Model definition
model = models.Sequential([
    keras.layers.InputLayer(input_shape=(64, 64, 1)),
    layers.Conv2D(32, (3, 3), activation='relu'),
    layers.MaxPooling2D((2, 2)),
    layers.Conv2D(64, (3, 3), activation='relu'),
    layers.MaxPooling2D((2, 2)),
    layers.Conv2D(128, (3, 3), activation='relu'),
    layers.MaxPooling2D((2, 2)),
    layers.Flatten(),
    layers.Dense(128, activation='relu'),
    layers.Dropout(0.5),
    layers.Dense(len(set(labels)), activation='softmax')
])

model.compile(
    optimizer='adam',
    loss='sparse_categorical_crossentropy',
    metrics=['accuracy']
)

history = model.fit(
    train_ds,
    validation_data=val_ds,
    epochs=EPOCHS
)

# After training
model.save('model.keras')

# --- TensorFlow.js export ---

# Define the output directory for the TF.js model (update this for each block type as needed)
tfjs_output_dir = '../model'

# Ensure the output directory exists
os.makedirs(tfjs_output_dir, exist_ok=True)

# Save as .h5 for conversion
model.save('model.h5')

# Remove any previous TF.js files in the output directory
for fname in ['model.json', 'group1-shard1of1.bin']:
    try:
        os.remove(os.path.join(tfjs_output_dir, fname))
    except FileNotFoundError:
        pass

# Convert to TensorFlow.js format using the Python API
tfjs.converters.save_keras_model(model, tfjs_output_dir)

# After TensorFlow.js export, save class names to a file for reference
block_files = [f for f in os.listdir(os.path.join(os.path.dirname(__file__), 'blocks')) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
block_names = []
for fname in block_files:
    name = fname.rsplit('.', 1)[0]
    if name.endswith('_alt'):
        name = name[:-4]
    block_names.append(name)
class_names = [f"{block}{i}" for block in block_names for i in range(4)]
with open(os.path.join(tfjs_output_dir, 'class_names.txt'), 'w') as f:
    for name in class_names:
        f.write(f"{name}\n")

# Optional: Plot training history
plt.plot(history.history['accuracy'], label='train_accuracy')
plt.plot(history.history['val_accuracy'], label='val_accuracy')
plt.xlabel('Epoch')
plt.ylabel('Accuracy')
plt.legend(loc='lower right')
plt.savefig('training_history.png')
plt.show()

os.remove('model.h5')
os.remove('model.keras')