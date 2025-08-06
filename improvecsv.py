from transcoder import process_csv
import os


def main():
    csv_pfad = input(
        "Bitte gib den VOLLEN PFAD zur CSV-Datei ein (z.B. C:\\Users\\david\\Desktop\\Python CSV\\Dateiname.csv):\n> "
    ).strip()
    if csv_pfad.startswith('"') and csv_pfad.endswith('"'):
        csv_pfad = csv_pfad[1:-1]
    if not os.path.exists(csv_pfad):
        print(f"Datei nicht gefunden: {csv_pfad}")
        return

    out = process_csv(csv_pfad)
    print("\n✅ Fertig! Die Datei wurde erfolgreich erstellt:")
    print(out)


if __name__ == "__main__":
    main()
