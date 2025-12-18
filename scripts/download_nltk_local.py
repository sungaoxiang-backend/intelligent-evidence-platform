import nltk
import os
import ssl

def download_nltk_data():
    """
    Download required NLTK data packages to a local directory.
    This bypasses SSL verification if needed and downloads to ./nltk_data
    """
    # Target directory
    download_dir = os.path.join(os.getcwd(), 'nltk_data')
    os.makedirs(download_dir, exist_ok=True)
    
    print(f"Downloading NLTK data to: {download_dir}")

    # Handle SSL issues that sometimes occur in some environments
    try:
        _create_unverified_https_context = ssl._create_unverified_context
    except AttributeError:
        pass
    else:
        ssl._create_default_https_context = _create_unverified_https_context

    # List of required packages
    packages = [
        'punkt',
        'averaged_perceptron_tagger',
        'stopwords',
        'wordnet',
        'omw-1.4',
        'punkt_tab' # explicit addition for newer nltk versions sometimes needing this
    ]

    for package in packages:
        print(f"Downloading {package}...")
        try:
            nltk.download(package, download_dir=download_dir, quiet=False)
            print(f"✓ {package} downloaded successfully.")
        except Exception as e:
            print(f"✗ Failed to download {package}: {str(e)}")

    print("\nAll downloads handled. Please check for failures above.")
    print(f"Data is stored in: {download_dir}")

if __name__ == "__main__":
    download_nltk_data()
