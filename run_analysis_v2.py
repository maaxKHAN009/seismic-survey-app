"""Run wrapper for analysis_gui_v2"""
import sys
if __name__ == '__main__':
    from analysis_gui_v2 import SeismicAnalyzerApp
    app = SeismicAnalyzerApp()
    app.mainloop()
