import pandas as pd
import glob
import os

data_dir = os.path.abspath(
    r"d:\PROJECT\TrekTrail\ml\data\raw\geolife\Geolife Trajectories 1.3\Data"
)
output_csv = "data/geolife_extracted.csv"

# Map Geolife labels to TrekTrack labels
LABEL_MAP = {"walk": "WALKING", "bike": "CYCLING", "run": "RUNNING"}

all_dfs = []
user_dirs = sorted(glob.glob(os.path.join(data_dir, "*")))
print(f"Scanning {len(user_dirs)} users for labels...")

for user_dir in user_dirs:
    labels_file = os.path.join(user_dir, "labels.txt")
    if not os.path.exists(labels_file):
        continue

    print(f"Processing user: {os.path.basename(user_dir)}")

    try:
        labels_df = pd.read_csv(labels_file, sep="\t")
        labels_df["Start Time"] = pd.to_datetime(labels_df["Start Time"])
        labels_df["End Time"] = pd.to_datetime(labels_df["End Time"])

        traj_dir = os.path.join(user_dir, "Trajectory")
        traj_files = glob.glob(os.path.join(traj_dir, "*.plt"))

        for tfile in traj_files:
            df = pd.read_csv(
                tfile,
                skiprows=6,
                header=None,
                names=[
                    "latitude",
                    "longitude",
                    "zero",
                    "altitude",
                    "num_days",
                    "date",
                    "time",
                ],
                on_bad_lines="skip",
            )
            df["timestamp"] = pd.to_datetime(df["date"] + " " + df["time"])

            # Map labels
            df["label"] = None
            for _, row in labels_df.iterrows():
                mode = row["Transportation Mode"].strip().lower()
                if mode in LABEL_MAP:
                    mask = (df["timestamp"] >= row["Start Time"]) & (
                        df["timestamp"] <= row["End Time"]
                    )
                    df.loc[mask, "label"] = LABEL_MAP[mode]

            labeled = df[df["label"].notnull()].copy()
            if not labeled.empty:
                labeled["timestamp"] = labeled["timestamp"].astype("int64") // 10**6
                all_dfs.append(
                    labeled[["timestamp", "latitude", "longitude", "altitude", "label"]]
                )

            if len(all_dfs) >= 200:  # Limit files for speed
                break
    except Exception as e:
        print(f"Error on {user_dir}: {e}")
        continue

    if len(all_dfs) >= 200:
        break

print(f"Extracted {sum(len(d) for d in all_dfs) if all_dfs else 0} labeled points.")
if all_dfs:
    final_df = pd.concat(all_dfs)
    final_df.to_csv(output_csv, index=False)
    print(f"Saved to {output_csv}")
else:
    print("No relevant labeled data found.")
