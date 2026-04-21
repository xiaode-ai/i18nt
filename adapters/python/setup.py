from setuptools import setup, find_packages
import os

setup(
    name="i18nt-python",
    version="0.1.0",
    packages=find_packages(),
    description="Python adapter for i18nt - The universal i18n hub",
    long_description=open("README.md").read() if os.path.exists("README.md") else "",
    author="i18nt team",
    url="https://github.com/xiaode-ai/i18nt",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
    ],
)
