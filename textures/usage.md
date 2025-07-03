# Training and Data Generation
- Go to `./training`.
- Use a python 3.10 enviornment.
  - Run `conda env create -n date_gen python=3.10 -y`.
  - Or run `python3.10 -m venv date_gen-venv`.
  - Or something else.
- Run `pip install -r requirements.txt -y`.
- Replace `input.png` to be rotation `0` of the desired block (should be renamed to `input.png`).
- Run `python generate_variants.py` to generate normal data (`0`, `90`, `180`, `270` degree rotatons).
- Adding `--alt` will do blocks that flip and rotate like stone.
- Run `python train.py`.
- Move the output in `model_tfjs` to the correct folder in `models`.

# Average Color Setup
- Add the top texture of each block into `./type/blocks`.
- Run `pip install Pillow`.
- Run `python colors.py`