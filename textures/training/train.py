import tensorflow as tf
from tensorflow import keras
from keras import layers, models
import matplotlib.pyplot as plt
import os
import subprocess
import shutil
import tensorflowjs as tfjs

# Configuration
DATA_DIR = "./output"  # Use the output from generate_variants.py
IMAGE_SIZE = (64, 64)
BATCH_SIZE = 32
EPOCHS = 64
SEED = 42

# Load dataset (grayscale, no augmentation)
train_ds = keras.utils.image_dataset_from_directory(
    DATA_DIR,
    labels='inferred',
    label_mode='int',
    color_mode='grayscale',
    batch_size=BATCH_SIZE,
    image_size=IMAGE_SIZE,
    shuffle=True,
    seed=SEED,
    validation_split=0.2,
    subset='training'
)
val_ds = keras.utils.image_dataset_from_directory(
    DATA_DIR,
    labels='inferred',
    label_mode='int',
    color_mode='grayscale',
    batch_size=BATCH_SIZE,
    image_size=IMAGE_SIZE,
    shuffle=True,
    seed=SEED,
    validation_split=0.2,
    subset='validation'
)

# Prefetch for performance
AUTOTUNE = tf.data.AUTOTUNE
train_ds = train_ds.prefetch(AUTOTUNE)
val_ds = val_ds.prefetch(AUTOTUNE)

# Model definition
model = models.Sequential([
    keras.layers.InputLayer(input_shape=(64, 64, 1)),
    layers.Rescaling(1./255),
    layers.Conv2D(32, (3, 3), activation='relu'),
    layers.MaxPooling2D((2, 2)),
    layers.Conv2D(64, (3, 3), activation='relu'),
    layers.MaxPooling2D((2, 2)),
    layers.Conv2D(128, (3, 3), activation='relu'),
    layers.MaxPooling2D((2, 2)),
    layers.Flatten(),
    layers.Dense(128, activation='relu'),
    layers.Dropout(0.5),
    layers.Dense(4, activation='softmax')
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
tfjs_output_dir = './model_tfjs'

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