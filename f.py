import numpy as np
# Coefficient matrix A

A = np.array([
    [3, 5, 2, 4],
    [6, 12, 7, 9],
    [3, 11, 12, 9],
    [12, 24, 15, 23]
], dtype=float)

# Right-hand side vector b
b = np.array([19, 46, 46, 98], dtype=float)

print("Matrix A:\n", A)
print("\nVector b:\n", b)