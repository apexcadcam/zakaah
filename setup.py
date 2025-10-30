from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in zakaah/__init__.py
from zakaah import __version__ as version

setup(
	name="zakaah",
	version=version,
	description="Zakaah Management System for ERPNext",
	author="Your Team",
	author_email="you@example.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires,
)
