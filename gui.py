import sys
from PySide6.QtWidgets import (
    QApplication,
    QWidget,
    QVBoxLayout,
    QPushButton,
    QLabel,
    QListWidget,
    QFileDialog,
    QMessageBox,
)
from PySide6.QtCore import Qt
from transcoder import process_csv


class DropListWidget(QListWidget):
    def __init__(self):
        super().__init__()
        self.setAcceptDrops(True)

    def dragEnterEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            super().dragEnterEvent(event)

    def dragMoveEvent(self, event):
        if event.mimeData().hasUrls():
            event.acceptProposedAction()
        else:
            super().dragMoveEvent(event)

    def dropEvent(self, event):
        for url in event.mimeData().urls():
            path = url.toLocalFile()
            if path.lower().endswith('.csv'):
                self.addItem(path)
        event.acceptProposedAction()


class MainWindow(QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("CSV Transcoder")
        self.resize(400, 300)

        layout = QVBoxLayout(self)
        layout.addWidget(QLabel("Drag & drop CSV files here or use 'Select Files'."))

        self.list_widget = DropListWidget()
        layout.addWidget(self.list_widget)

        btn_select = QPushButton("Select Files")
        btn_select.clicked.connect(self.select_files)
        layout.addWidget(btn_select)

        btn_process = QPushButton("Process Files")
        btn_process.clicked.connect(self.process_files)
        layout.addWidget(btn_process)

    def select_files(self):
        files, _ = QFileDialog.getOpenFileNames(
            self, "Select CSV files", "", "CSV Files (*.csv)"
        )
        for f in files:
            self.list_widget.addItem(f)

    def process_files(self):
        items = [self.list_widget.item(i).text() for i in range(self.list_widget.count())]
        if not items:
            QMessageBox.warning(self, "No files", "Please add at least one CSV file.")
            return
        outputs = []
        for path in items:
            try:
                out_path = process_csv(path)
                outputs.append(out_path)
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Error processing {path}:\n{e}")
                return
        QMessageBox.information(
            self,
            "Done",
            "Processed files:\n" + "\n".join(outputs)
        )
        self.list_widget.clear()


def main():
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())


if __name__ == "__main__":
    main()
